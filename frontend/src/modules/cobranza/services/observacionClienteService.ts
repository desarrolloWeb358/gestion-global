// src/modules/cobranza/services/observacionClienteService.ts
import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type FieldValue,
  type CollectionReference,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { ObservacionCliente } from "../models/observacionCliente.model";

/**
 * Documento en Firestore para Observaciones del Cliente.
 * Usamos creadoTs para ordenar/mostrar (y dejamos fechaTs como alias para compat).
 */
type ObservacionClienteDoc = {
  texto: string;
  creadoTs: Timestamp | FieldValue;
  fechaTs?: Timestamp | FieldValue; // alias opcional para compatibilidad
  creadoPorUid?: string | null;
  creadoPorNombre?: string | null;
};

type Scope = "deudor" | "valor";

/** Build path según el scope (parent) */
function colPath(clienteId: string, parentId: string, scope: Scope): string {
  if (scope === "deudor") {
    // Ruta histórica usada por Seguimiento
    return `clientes/${clienteId}/deudores/${parentId}/observacionesCliente`;
  }
  // Ruta para Valor Agregado
  return `clientes/${clienteId}/valoresAgregados/${parentId}/observacionesCliente`;
}

/** Colección tipada */
function colRef(clienteId: string, parentId: string, scope: Scope) {
  return collection(db, colPath(clienteId, parentId, scope)) as CollectionReference<ObservacionClienteDoc>;
}

/** =========================
 *  LECTURA (lista) - GENÉRICO
 *  ========================= */
export async function getObservacionesClienteGeneric(
  clienteId: string,
  parentId: string,
  scope: Scope
): Promise<ObservacionCliente[]> {
  const q = query(colRef(clienteId, parentId, scope), orderBy("creadoTs", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as DocumentData;
    const ts = (data.creadoTs as Timestamp | undefined) ?? null;
    // compat: si solo tuviera fechaTs
    const legacyTs = (data.fechaTs as Timestamp | undefined) ?? null;
    const finalTs = ts || legacyTs || null;

    return {
      id: d.id,
      texto: (data.texto as string) ?? "",
      // campos que tu UI podría leer:
      creadoTs: finalTs,
      fechaTs: finalTs,
      creadoPorUid: (data.creadoPorUid as string | null) ?? null,
      creadoPorNombre: (data.creadoPorNombre as string | null) ?? null,
      // Atajos útiles (por si tu modelo lo tiene):
      fecha: finalTs ? finalTs.toDate() : undefined,
    } as ObservacionCliente;
  });
}

/** =========================
 *  CREACIÓN - GENÉRICO
 *  ========================= */
export async function addObservacionClienteGeneric(
  clienteId: string,
  parentId: string,
  texto: string,
  scope: Scope,
  meta?: { creadoPorUid?: string | null; creadoPorNombre?: string | null }
): Promise<string> {
  const ref = await addDoc(colRef(clienteId, parentId, scope), {
    texto,
    creadoTs: serverTimestamp(),
    fechaTs: serverTimestamp(), // alias para compatibilidad con UIs antiguas
    creadoPorUid: meta?.creadoPorUid ?? null,
    creadoPorNombre: meta?.creadoPorNombre ?? null,
  });
  return ref.id;
}

/** =========================
 *  UPDATE / DELETE - GENÉRICOS
 *  ========================= */
export async function updateObservacionClienteGeneric(
  clienteId: string,
  parentId: string,
  obsId: string,
  nuevoTexto: string,
  scope: Scope
): Promise<void> {
  const ref = doc(db, `${colPath(clienteId, parentId, scope)}/${obsId}`);
  await updateDoc(ref, {
    texto: nuevoTexto,
    // Podríamos actualizar un updatedTs si quieres auditar ediciones:
    // updatedTs: serverTimestamp(),
  });
}

export async function deleteObservacionClienteGeneric(
  clienteId: string,
  parentId: string,
  obsId: string,
  scope: Scope
): Promise<void> {
  const ref = doc(db, `${colPath(clienteId, parentId, scope)}/${obsId}`);
  await deleteDoc(ref);
}

/* ===========================================================
 *  API COMPATIBLE CON SEGUIMIENTO (PARENT = DEUDOR)
 * =========================================================== */
export async function getObservacionesCliente(
  clienteId: string,
  deudorId: string
): Promise<ObservacionCliente[]> {
  return getObservacionesClienteGeneric(clienteId, deudorId, "deudor");
}

export async function addObservacionCliente(
  clienteId: string,
  deudorId: string,
  texto: string,
  meta?: { creadoPorUid?: string | null; creadoPorNombre?: string | null }
): Promise<string> {
  return addObservacionClienteGeneric(clienteId, deudorId, texto, "deudor", meta);
}

/* ===========================================================
 *  API PARA VALOR AGREGADO (PARENT = VALOR)
 *  Estas son las DOS que dijiste que “toca agregar”.
 * =========================================================== */
export async function getObservacionesClienteValor(
  clienteId: string,
  valorId: string
): Promise<ObservacionCliente[]> {
  return getObservacionesClienteGeneric(clienteId, valorId, "valor");
}

export async function addObservacionClienteValor(
  clienteId: string,
  valorId: string,
  texto: string,
  meta?: { creadoPorUid?: string | null; creadoPorNombre?: string | null }
): Promise<string> {
  return addObservacionClienteGeneric(clienteId, valorId, texto, "valor", meta);
}

/* ===========================================================
 *  UPDATE / DELETE con soporte para ambos scopes
 *  (útil si tu UI de Valor Agregado permite editar/eliminar)
 * =========================================================== */
export async function updateObservacionCliente(
  clienteId: string,
  parentId: string,
  obsId: string,
  nuevoTexto: string,
  scope: Scope = "deudor"
): Promise<void> {
  return updateObservacionClienteGeneric(clienteId, parentId, obsId, nuevoTexto, scope);
}

export async function deleteObservacionCliente(
  clienteId: string,
  parentId: string,
  obsId: string,
  scope: Scope = "deudor"
): Promise<void> {
  return deleteObservacionClienteGeneric(clienteId, parentId, obsId, scope);
}
