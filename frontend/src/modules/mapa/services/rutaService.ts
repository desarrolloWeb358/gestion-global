import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";

export interface PuntoRuta {
  lat: number;
  lng: number;
}

/** Punto de partida habitual de las visitas (verificado en Google Maps: Gestión Global ACG S.A.S.). */
export const OFICINA = {
  nombre: "Oficina Gestión Global",
  direccion: "Calle 24 Sur # 68H-52, Kennedy",
  lat: 4.6127913,
  lng: -74.1318398,
};

/** Tope de la Cloud Function y de lo que Google Maps abre en el celular sin cortar paradas. */
export const MAX_PARADAS = 8;

export interface ResultadoRuta {
  orden: string[]; // ids de cliente en el orden de visita
  tramos: { haciaId: string; segundos: number; metros: number }[];
  totalSegundos: number;
  totalMetros: number;
  polyline: string | null;
}

export async function calcularRuta(origen: PuntoRuta, paradas: (PuntoRuta & { id: string })[]): Promise<ResultadoRuta> {
  const fn = httpsCallable<unknown, ResultadoRuta>(functions, "calcularRutaVisitas");
  const res = await fn({ origen, paradas });
  return res.data;
}

/**
 * Abre la navegación en Google Maps / Waze con las paradas ya ordenadas. Es un
 * enlace, no una llamada a la API: no consume cuota.
 */
export function urlNavegacion(origen: PuntoRuta | null, orden: PuntoRuta[]): string {
  const p = (x: PuntoRuta) => `${x.lat},${x.lng}`;
  const params = new URLSearchParams({ api: "1", travelmode: "driving", destination: p(orden[orden.length - 1]) });
  // Sin origen, Google Maps sale de donde está el celular.
  if (origen) params.set("origin", p(origen));
  if (orden.length > 1) params.set("waypoints", orden.slice(0, -1).map(p).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function textoDuracion(segundos: number): string {
  const min = Math.round(segundos / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

export function textoDistancia(metros: number): string {
  return metros < 1000 ? `${metros} m` : `${(metros / 1000).toFixed(1)} km`;
}

/** Ubicación del celular; en PC suele ser aproximada. */
export function miUbicacion(): Promise<PuntoRuta> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Este dispositivo no comparte su ubicación."));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error("No se pudo obtener tu ubicación. Revisa el permiso de ubicación del navegador.")),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}
