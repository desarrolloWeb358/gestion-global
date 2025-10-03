// src/modules/cobranza/services/observacionClienteService.ts
import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { ObservacionCliente } from "../models/observacionCliente.model";

const colRef = (clienteId: string, deudorId: string) =>
  collection(db, `clientes/${clienteId}/deudores/${deudorId}/observacionesCliente`);

export async function getObservacionesCliente(
  clienteId: string,
  deudorId: string
): Promise<ObservacionCliente[]> {
  const q = query(colRef(clienteId, deudorId), orderBy("fecha", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ObservacionCliente) }));
}

export async function addObservacionCliente(
  clienteId: string,
  deudorId: string,
  texto: string,
  autorUid?: string | null
): Promise<string> {
  const ref = await addDoc(colRef(clienteId, deudorId), {
    texto,
    autorUid: autorUid ?? null,
    fecha: serverTimestamp(),
  } as Partial<ObservacionCliente>);
  return ref.id;
}
