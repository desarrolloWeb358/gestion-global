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

/** Quita undefined, NaN y normaliza strings vacíos a null */
function sanitizeValue(v: any) {
  if (v === undefined) return undefined; // lo filtramos luego
  if (typeof v === "number" && Number.isNaN(v)) return undefined;
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
}

/** Limpia un objeto: sin undefined/NaN, y "" -> null */
function clean<T extends Record<string, any>>(obj: T): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k in obj) {
    if (k === "id") continue; // nunca mandar id al doc
    const sv = sanitizeValue(obj[k]);
    if (sv !== undefined) out[k] = sv;
  }
  return out;
}

/** Normaliza tipo: números a número, strings vacíos a null, mes "YYYY-MM" */
function normalizeEstado(input: Partial<EstadoMensual>): Record<string, any> {
  const n: Record<string, any> = {
    mes: input.mes ?? null,
    deuda: input.deuda ?? null,
    recaudo: input.recaudo ?? null,
    honorarios: input.honorarios ?? null,
    recibo: input.recibo ?? null,
    observaciones: input.observaciones ?? null,
  };

  // coerciones numéricas seguras
  const asNum = (x: any) =>
    x === null || x === "" || x === undefined ? null : Number(x);

  n.deuda = asNum(n.deuda);
  n.recaudo = asNum(n.recaudo);
  n.honorarios = asNum(n.honorarios);

  // mes como string YYYY-MM o null
  if (typeof n.mes === "string") {
    n.mes = n.mes.slice(0, 7); // "YYYY-MM"
  } else if (n.mes === undefined) {
    n.mes = null;
  }

  return clean(n);
}

/** Chequea si un registro está "vacío" (sin mes y sin valores útiles) */
function isEmptyRow(input: Partial<EstadoMensual>) {
  const n = normalizeEstado(input);
  // si no hay mes ni ningún campo con valor distinto de null, se considera vacío
  const keys = Object.keys(n);
  const hasAnyValue = keys.some((k) => n[k] !== null && n[k] !== undefined);
  const hasMes = !!n.mes;
  return !hasMes && !hasAnyValue;
}

export async function obtenerEstadosMensuales(
  clienteId: string,
  deudorId: string
): Promise<EstadoMensual[]> {
  const ref = collection(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales`
  );

  // opcional: ordenar por mes si lo quieres consistente
  const q = query(ref, orderBy("mes", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as EstadoMensual));
}

/** CREATE seguro: limpia antes de escribir (evita undefined) */
export async function crearEstadoMensual(
  clienteId: string,
  deudorId: string,
  estadoMensual: Partial<EstadoMensual>
) {
  const ref = collection(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales`
  );

  const payload = normalizeEstado(estadoMensual);

  // Regla mínima: exigir "mes" para guardar (evita docs inválidos)
  if (!payload.mes) {
    throw new Error("El campo 'mes' es obligatorio para crear un estado mensual.");
  }

  await addDoc(ref, payload);
}

/** UPDATE seguro: limpia antes de enviar (sin undefined) */
export async function actualizarEstadoMensual(
  clienteId: string,
  deudorId: string,
  estadoMensual: Partial<EstadoMensual>
) {
  if (!estadoMensual.id) return;
  const ref = doc(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales/${estadoMensual.id}`
  );
  const payload = normalizeEstado(estadoMensual);
  await updateDoc(ref, payload);
}

export async function eliminarEstadoMensual(
  clienteId: string,
  deudorId: string,
  estadoMensualId: string
) {
  const ref = doc(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales/${estadoMensualId}`
  );
  await deleteDoc(ref);
}

/**
 * MASIVO: inserta/actualiza varios registros.
 * - Salta filas completamente vacías.
 * - Si setIdByMonth=true, hace upsert con id = mes (evita duplicados por mes).
 */
export async function crearEstadosMensualesMasivo(
  clienteId: string,
  deudorId: string,
  items: Array<Partial<EstadoMensual>>,
  options?: { setIdByMonth?: boolean } // upsert por mes
) {
  const { setIdByMonth = false } = options ?? {};
  const basePath = `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales`;
  const batch = writeBatch(db);

  for (const it of items) {
    if (isEmptyRow(it)) continue; // saltar filas vacías

    const payload = normalizeEstado(it);

    // Si no hay "mes", no podremos identificar el doc → descartamos
    if (!payload.mes) continue;

    if (setIdByMonth) {
      // Upsert por mes: id = "YYYY-MM"
      const id = String(payload.mes);
      const r = doc(db, `${basePath}/${id}`);
      batch.set(r, payload, { merge: true });
    } else {
      // Insert normal (id aleatorio)
      const r = doc(collection(db, basePath));
      batch.set(r, payload, { merge: true });
    }
  }

  await batch.commit();
}
