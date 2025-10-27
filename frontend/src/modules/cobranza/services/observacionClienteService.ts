// src/modules/cobranza/services/observacionClienteService.ts
import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  type CollectionReference,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { ObservacionCliente } from "../models/observacionCliente.model";

type Scope = "deudor" | "valor";

// Estructura exacta que se guarda en Firestore
type ObservacionClienteDoc = {
  texto: string;
  fecha: Timestamp; // único campo temporal
};

function colPath(clienteId: string, parentId: string, scope: Scope): string {
  return scope === "deudor"
    ? `clientes/${clienteId}/deudores/${parentId}/observacionesCliente`
    : `clientes/${clienteId}/valoresAgregados/${parentId}/observacionesCliente`;
}

function colRef(clienteId: string, parentId: string, scope: Scope) {
  return collection(db, colPath(clienteId, parentId, scope)) as CollectionReference<ObservacionClienteDoc>;
}

/* ========== READ (lista) ========== */
export async function getObservacionesClienteGeneric(
  clienteId: string,
  parentId: string,
  scope: Scope
): Promise<ObservacionCliente[]> {
  const q = query(colRef(clienteId, parentId, scope), orderBy("fecha", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data(); // { texto, fecha }
    const item: ObservacionCliente = {
      id: d.id,
      texto: data.texto ?? "",
      fecha: data.fecha ?? null,
    };
    return item;
  });
}

/* ========== CREATE ========== */
export async function addObservacionClienteGeneric(
  clienteId: string,
  parentId: string,
  texto: string,
  scope: Scope
): Promise<string> {
  const ref = await addDoc(colRef(clienteId, parentId, scope), {
    texto,
    fecha: serverTimestamp() as unknown as Timestamp, // único timestamp
  });
  return ref.id;
}

/* ========== UPDATE ========== */
export async function updateObservacionClienteGeneric(
  clienteId: string,
  parentId: string,
  obsId: string,
  nuevoTexto: string,
  scope: Scope
): Promise<void> {
  const ref = doc(db, `${colPath(clienteId, parentId, scope)}/${obsId}`);
  await updateDoc(ref, { texto: nuevoTexto }); // no tocamos `fecha`
}

/* ========== DELETE ========== */
export async function deleteObservacionClienteGeneric(
  clienteId: string,
  parentId: string,
  obsId: string,
  scope: Scope
): Promise<void> {
  const ref = doc(db, `${colPath(clienteId, parentId, scope)}/${obsId}`);
  await deleteDoc(ref);
}

/* ===== Facades por scope (deudor / valor) ===== */
export async function getObservacionesCliente(
  clienteId: string,
  deudorId: string
): Promise<ObservacionCliente[]> {
  return getObservacionesClienteGeneric(clienteId, deudorId, "deudor");
}

export async function addObservacionCliente(
  clienteId: string,
  deudorId: string,
  texto: string
): Promise<string> {
  return addObservacionClienteGeneric(clienteId, deudorId, texto, "deudor");
}

export async function getObservacionesClienteValor(
  clienteId: string,
  valorId: string
): Promise<ObservacionCliente[]> {
  return getObservacionesClienteGeneric(clienteId, valorId, "valor");
}

export async function addObservacionClienteValor(
  clienteId: string,
  valorId: string,
  texto: string
): Promise<string> {
  return addObservacionClienteGeneric(clienteId, valorId, texto, "valor");
}

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
