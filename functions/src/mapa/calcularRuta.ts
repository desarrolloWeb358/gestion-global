// Mejor orden para visitar varios conjuntos saliendo de un punto (la oficina o
// la ubicacion del celular) y terminando en el ultimo conjunto.
//
// Por que no `optimizeWaypointOrder` de Google: ese exige fijar el destino, y
// aqui el ultimo conjunto tambien se elige. Con 3-4 visitas al dia (maximo 8)
// probar todos los ordenes sobre una matriz de tiempos es exacto y barato:
//   1) una matriz SIN trafico (SKU Essentials, cuota gratis amplia) para ordenar,
//   2) una sola ruta CON trafico (SKU Pro) para los tiempos reales y la linea.
// La key es la de servidor: nunca sale al navegador.

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { GOOGLE_MAPS_SERVER_KEY } from "./geocodificarClienteTrigger";

const MAX_PARADAS = 8;

interface Punto {
  lat: number;
  lng: number;
}
interface Parada extends Punto {
  id: string;
}

const esPunto = (p: any): p is Punto =>
  p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

const waypoint = (p: Punto) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
const segundos = (d: string | undefined) => (d ? parseInt(d, 10) : NaN); // "123s" → 123

/** Google devuelve el error como objeto o, en la matriz, dentro de una lista. */
function errorDe(nombre: string, status: number, json: any): Error {
  const e = Array.isArray(json) ? json[0]?.error : json?.error;
  return new Error(`${nombre}: ${e?.status ?? status} ${e?.message ?? ""}`.trim());
}

async function matrizDeTiempos(origen: Punto, paradas: Parada[], key: string): Promise<number[][]> {
  // Filas: 0 = origen, i+1 = parada i. Columnas: parada j.
  const res = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "originIndex,destinationIndex,duration,condition",
    },
    body: JSON.stringify({
      origins: [origen, ...paradas].map((p) => ({ waypoint: waypoint(p) })),
      destinations: paradas.map((p) => ({ waypoint: waypoint(p) })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
    }),
  });
  const json: any = await res.json();
  if (!res.ok) throw errorDe("Route Matrix", res.status, json);
  const m = Array.from({ length: paradas.length + 1 }, () => Array(paradas.length).fill(Infinity));
  for (const e of json as any[]) {
    if (e.condition === "ROUTE_EXISTS") m[e.originIndex ?? 0][e.destinationIndex ?? 0] = segundos(e.duration);
  }
  return m;
}

/** Todos los ordenes posibles; con <= 8 paradas son <= 40.320. */
function mejorOrden(m: number[][], n: number): number[] {
  let mejor: number[] = [];
  let costoMejor = Infinity;
  const usado = Array(n).fill(false);
  const actual: number[] = [];
  const recorrer = (fila: number, costo: number) => {
    if (costo >= costoMejor) return;
    if (actual.length === n) {
      costoMejor = costo;
      mejor = [...actual];
      return;
    }
    for (let j = 0; j < n; j++) {
      if (usado[j]) continue;
      usado[j] = true;
      actual.push(j);
      recorrer(j + 1, costo + m[fila][j]);
      actual.pop();
      usado[j] = false;
    }
  };
  recorrer(0, 0);
  if (!mejor.length) throw new HttpsError("not-found", "Google no encontró cómo llegar a alguno de los conjuntos en carro.");
  return mejor;
}

async function rutaConTrafico(origen: Punto, orden: Parada[], key: string) {
  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters",
    },
    body: JSON.stringify({
      origin: waypoint(origen),
      destination: waypoint(orden[orden.length - 1]),
      intermediates: orden.slice(0, -1).map(waypoint),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      languageCode: "es-CO",
      regionCode: "CO",
    }),
  });
  const json: any = await res.json();
  if (!res.ok) throw errorDe("Compute Routes", res.status, json);
  const r = json.routes?.[0];
  if (!r) throw new HttpsError("not-found", "Google no devolvió una ruta para esos conjuntos.");
  return r;
}

export const calcularRutaVisitas = onCall(
  { region: "us-central1", secrets: [GOOGLE_MAPS_SERVER_KEY], invoker: "public" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    const { origen, paradas } = (request.data ?? {}) as { origen?: Punto; paradas?: Parada[] };
    if (!esPunto(origen)) throw new HttpsError("invalid-argument", "Falta el punto de partida.");
    if (!Array.isArray(paradas) || paradas.length === 0) throw new HttpsError("invalid-argument", "Elige al menos un conjunto.");
    if (paradas.length > MAX_PARADAS) throw new HttpsError("invalid-argument", `Máximo ${MAX_PARADAS} conjuntos por ruta.`);
    if (!paradas.every((p) => esPunto(p) && typeof p.id === "string")) {
      throw new HttpsError("invalid-argument", "Algún conjunto no tiene ubicación.");
    }

    const key = GOOGLE_MAPS_SERVER_KEY.value();
    try {
      const orden =
        paradas.length === 1 ? [0] : mejorOrden(await matrizDeTiempos(origen, paradas, key), paradas.length);
      const ordenadas = orden.map((i) => paradas[i]);
      const r = await rutaConTrafico(origen, ordenadas, key);
      const tramos = (r.legs ?? []).map((l: any, i: number) => ({
        haciaId: ordenadas[i].id,
        segundos: segundos(l.duration) || 0,
        metros: l.distanceMeters ?? 0,
      }));
      logger.info("calcularRutaVisitas", { uid: request.auth.uid, paradas: paradas.length });
      return {
        orden: ordenadas.map((p) => p.id),
        tramos,
        totalSegundos: segundos(r.duration) || 0,
        totalMetros: r.distanceMeters ?? 0,
        polyline: r.polyline?.encodedPolyline ?? null,
      };
    } catch (e: any) {
      if (e instanceof HttpsError) throw e;
      logger.error("calcularRutaVisitas fallo", { error: e?.message });
      if (/PERMISSION_DENIED|API_KEY|not been used|disabled/i.test(e?.message ?? "")) {
        throw new HttpsError("failed-precondition", "La Routes API no está habilitada para la key del servidor.");
      }
      throw new HttpsError("internal", "No se pudo calcular la ruta. Intenta de nuevo.");
    }
  }
);
