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
} from "firebase/firestore";
import { db } from "@/firebase";
import type { ObservacionCliente } from "../models/observacionCliente.model";

// Tipo del documento tal como vive en Firestore
// (cuando escribimos, puede ser FieldValue; cuando leemos será Timestamp)
type ObservacionClienteDoc = {
  texto: string;
  fechaTs: Timestamp | FieldValue;
};

// Tipamos la colección, NO el addDoc
const colRef = (
  clienteId: string,
  deudorId: string
) =>
  collection(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/observacionesCliente`
  ) as CollectionReference<ObservacionClienteDoc>;

export async function getObservacionesCliente(
  clienteId: string,
  deudorId: string
): Promise<ObservacionCliente[]> {
  const q = query(colRef(clienteId, deudorId), orderBy("fechaTs", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as DocumentData;
    const ts = (data.fechaTs as Timestamp | undefined) ?? null;
    return {
      id: d.id,
      texto: (data.texto as string) ?? "",
      fechaTs: ts,
      fecha: ts ? ts.toDate() : new Date(0),
    } as ObservacionCliente;
  });
}

export async function addObservacionCliente(
  clienteId: string,
  deudorId: string,
  texto: string
): Promise<string> {
  const ref = await addDoc(colRef(clienteId, deudorId), {
    texto,
    fechaTs: serverTimestamp(), // OK: FieldValue
  });
  return ref.id;
}
