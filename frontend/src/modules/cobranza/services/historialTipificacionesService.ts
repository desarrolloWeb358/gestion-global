// src/modules/cobranza/services/historialTipificacionService.ts
import { db } from "@/firebase";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { HistorialTipificacion } from "../models/historialTipificacion.model";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";

function toTimestampSafe(v: any): Timestamp {
  if (!v) return Timestamp.fromDate(new Date());
  if (v instanceof Timestamp) return v;
  if (v instanceof Date) return Timestamp.fromDate(v);
  if (typeof v?.seconds === "number") return new Timestamp(v.seconds, v.nanoseconds ?? 0);
  return Timestamp.fromDate(new Date(v));
}

export function normalizeHistorialTipificacion(input: Partial<HistorialTipificacion>) {
  const out: any = {
    fecha: input.fecha ? toTimestampSafe(input.fecha) : Timestamp.fromDate(new Date()),
    tipificacion: input.tipificacion ?? TipificacionDeuda.GESTIONANDO,
  };

  // limpia undefined
  const clean: any = {};
  for (const k of Object.keys(out)) if (out[k] !== undefined) clean[k] = out[k];
  return clean;
}

export async function obtenerHistorialTipificaciones(
  clienteId: string,
  deudorId: string
): Promise<HistorialTipificacion[]> {
  const ref = collection(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/historialTipificaciones`
  );
  const q = query(ref, orderBy("fecha", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as HistorialTipificacion));
}

export async function crearHistorialTipificacion(
  clienteId: string,
  deudorId: string,
  item: Partial<HistorialTipificacion>
) {
  const ref = collection(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/historialTipificaciones`
  );
  const payload = normalizeHistorialTipificacion(item);
  await addDoc(ref, payload);
}

export async function actualizarHistorialTipificacion(
  clienteId: string,
  deudorId: string,
  item: Partial<HistorialTipificacion> & { id: string }
) {
  const ref = doc(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/historialTipificaciones/${item.id}`
  );
  const payload = normalizeHistorialTipificacion(item);
  await updateDoc(ref, payload);
}

export async function eliminarHistorialTipificacion(
  clienteId: string,
  deudorId: string,
  historialId: string
) {
  const ref = doc(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/historialTipificaciones/${historialId}`
  );
  await deleteDoc(ref);
}

/**
 * ✅ Recomendado para tu UI (popup):
 * Reemplaza TODO el historial por el arreglo enviado (sin solapes / sin líos).
 * - Borra los docs existentes
 * - Crea docs nuevos en el orden que le pasas
 */
export async function reemplazarHistorialTipificaciones(
  clienteId: string,
  deudorId: string,
  items: Array<Partial<HistorialTipificacion>>
) {
  const baseRef = collection(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/historialTipificaciones`
  );

  const snap = await getDocs(baseRef);
  const batch = writeBatch(db);

  // 1) borrar todo
  snap.docs.forEach((d) => batch.delete(d.ref));

  // 2) crear todo de nuevo
  items.forEach((it) => {
    const payload = normalizeHistorialTipificacion(it);
    const newRef = doc(baseRef); // id random
    batch.set(newRef, payload, { merge: true });
  });

  await batch.commit();
}

/** Devuelve la "tipificación activa": la última por fecha */
export function tipificacionActivaDesdeHistorial(items: Array<Partial<HistorialTipificacion>>): TipificacionDeuda {
  const norm = items
    .map((x) => ({
      tipificacion: x.tipificacion ?? TipificacionDeuda.GESTIONANDO,
      fecha: toTimestampSafe(x.fecha).toMillis(),
    }))
    .sort((a, b) => a.fecha - b.fecha);

  return (norm[norm.length - 1]?.tipificacion ?? TipificacionDeuda.GESTIONANDO) as TipificacionDeuda;
}
