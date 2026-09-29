import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/firebase";
import type { Cliente } from "@/modules/clientes/models/cliente.model";

/**
 * Pin corregido a mano. Se guarda con la dirección VIGENTE como
 * `direccionOrigen`, así la Cloud Function no lo pisa; si alguien cambia la
 * dirección después, se vuelve a calcular (el pin viejo ya no aplicaría).
 */
export async function guardarUbicacionManual(
  cliente: Cliente,
  pos: { lat: number; lng: number },
  uid: string
): Promise<void> {
  if (!cliente.id) throw new Error("Cliente sin id");
  await updateDoc(doc(db, "clientes", cliente.id), {
    geo: {
      estado: "ok",
      fuente: "manual",
      lat: pos.lat,
      lng: pos.lng,
      precision: "exacta",
      direccionFormateada: cliente.geo?.direccionFormateada ?? null,
      placeId: null,
      municipio: cliente.geo?.municipio ?? null,
      localidad: cliente.geo?.localidad ?? null,
      consulta: null,
      direccionOrigen: String(cliente.direccion ?? "").trim(),
      motivoRevision: null,
      actualizadoEn: serverTimestamp(),
      corregidoPor: uid,
    },
  });
}

/** Enlace que abre Google Maps / Waze en el celular. No consume cuota de la API. */
export function urlComoLlegar(cliente: Cliente): string {
  const g = cliente.geo;
  const destino =
    g?.lat != null && g?.lng != null
      ? `${g.lat},${g.lng}`
      : `${cliente.direccion ?? ""}, ${cliente.ciudad ?? "Bogotá"}, Colombia`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
}

export function tieneUbicacion(c: Cliente): boolean {
  return c.geo?.lat != null && c.geo?.lng != null && c.geo.estado !== "sin_resultado";
}
