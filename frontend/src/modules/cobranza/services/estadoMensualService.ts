import { db } from "@/firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { EstadoMensual } from "../models/estadoMensual.model";

export async function obtenerEstadosMensuales(clienteId: string, deudorId: string): Promise<EstadoMensual[]> {
  const ref = collection(db, `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales`);
  const snapshot = await getDocs(ref);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as EstadoMensual));
}

export async function crearEstadoMensual(clienteId: string, deudorId: string, estadoMensual: EstadoMensual) {
  const ref = collection(db, `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales`);
  await addDoc(ref, estadoMensual);
}

export async function actualizarEstadoMensual(clienteId: string, deudorId: string, estadoMensual: EstadoMensual) {
  if (!estadoMensual.id) return;
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales/${estadoMensual.id}`);
  await updateDoc(ref, cleanEstadoMensual(estadoMensual));
}

export async function eliminarEstadoMensual(clienteId: string, deudorId: string, estadoMensualId: string) {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales/${estadoMensualId}`);
  await deleteDoc(ref);
}

function cleanEstadoMensual(estadoMensual: EstadoMensual): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key in estadoMensual) {
    const value = (estadoMensual as any)[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}