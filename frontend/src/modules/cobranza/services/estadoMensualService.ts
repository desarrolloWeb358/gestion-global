// src/modules/deudores/services/estadoMensualService.ts
import { db } from "@/firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  setDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { EstadoMensual } from "../models/estadoMensual.model";

/* ---------- Helpers compartidos ---------- */
export const toNullableNumber = (v: any) =>
  v === "" || v === undefined || v === null ? null : Number(v);

export function normalizeEstado(input: Partial<EstadoMensual>): Record<string, any> {
  const n: Record<string, any> = {
    mes: input.mes ?? null,
    deuda: input.deuda,
    recaudo: input.recaudo,
    porcentajeHonorarios: input.porcentajeHonorarios,
    honorariosDeuda: input.honorariosDeuda,
    honorariosRecaudo: input.honorariosRecaudo,
    recibo: input.recibo ?? "",
    observaciones: input.observaciones ?? "",
  };

  n.deuda = toNullableNumber(n.deuda);
  n.recaudo = toNullableNumber(n.recaudo);
  n.porcentajeHonorarios = toNullableNumber(n.porcentajeHonorarios);
  n.honorariosDeuda = toNullableNumber(n.honorariosDeuda);
  n.honorariosRecaudo = toNullableNumber(n.honorariosRecaudo);

  // mes "YYYY-MM"
  if (typeof n.mes === "string") n.mes = n.mes.slice(0, 7);
  else if (n.mes === undefined) n.mes = null;

  // limpia undefined
  const out: Record<string, any> = {};
  for (const k of Object.keys(n)) if (n[k] !== undefined) out[k] = n[k];
  return out;
}

function isEmptyRow(input: Partial<EstadoMensual>) {
  const n = normalizeEstado(input);
  const keys = Object.keys(n);
  const hasAnyValue = keys.some((k) => n[k] !== null && n[k] !== undefined);
  const hasMes = !!n.mes;
  return !hasMes && !hasAnyValue;
}

/* ---------- CRUD ---------- */
export async function obtenerEstadosMensuales(
  clienteId: string,
  deudorId: string
): Promise<EstadoMensual[]> {
  const ref = collection(db, `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales`);
  const q = query(ref, orderBy("mes", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as EstadoMensual));
}

/** Crear “estricto” (addDoc). Úsalo solo si aceptas duplicados; para UI usa el upsert. */
export async function crearEstadoMensual(
  clienteId: string,
  deudorId: string,
  estadoMensual: Partial<EstadoMensual>
) {
  const ref = collection(db, `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales`);
  const payload = normalizeEstado(estadoMensual);
  if (!payload.mes) throw new Error("El campo 'mes' es obligatorio para crear un estado mensual.");
  await addDoc(ref, payload);
}

export async function actualizarEstadoMensual(
  clienteId: string,
  deudorId: string,
  estadoMensual: Partial<EstadoMensual>
) {
  if (!estadoMensual.id) return;
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales/${estadoMensual.id}`);
  const payload = normalizeEstado(estadoMensual);
  await updateDoc(ref, payload);
}

export async function eliminarEstadoMensual(
  clienteId: string,
  deudorId: string,
  estadoMensualId: string
) {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales/${estadoMensualId}`);
  await deleteDoc(ref);
}

/** Masivo con upsert opcional por mes (id = "YYYY-MM") */
export async function crearEstadosMensualesMasivo(
  clienteId: string,
  deudorId: string,
  items: Array<Partial<EstadoMensual>>,
  options?: { setIdByMonth?: boolean }
) {
  const { setIdByMonth = false } = options ?? {};
  const basePath = `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales`;
  const batch = writeBatch(db);

  for (const it of items) {
    if (isEmptyRow(it)) continue;
    const payload = normalizeEstado(it);
    if (!payload.mes) continue;

    if (setIdByMonth) {
      const id = String(payload.mes);
      const r = doc(db, `${basePath}/${id}`);
      batch.set(r, payload, { merge: true });
    } else {
      const r = doc(collection(db, basePath));
      batch.set(r, payload, { merge: true });
    }
  }
  await batch.commit();
}

/** ✅ Recomendado para UI: UPSERT por mes (id = "YYYY-MM") */
export async function upsertEstadoMensualPorMes(
  clienteId: string,
  deudorId: string,
  estadoMensual: Partial<EstadoMensual>
) {
  const payload = normalizeEstado(estadoMensual);
  if (!payload.mes) throw new Error("El campo 'mes' es obligatorio.");
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales/${String(payload.mes)}`);
  await setDoc(ref, payload, { merge: true });
}
