import { db } from "@/firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { Abono } from "../models/abono.model";

export async function obtenerAbonos(clienteId: string, deudorId: string): Promise<Abono[]> {
  const ref = collection(db, `clientes/${clienteId}/deudores/${deudorId}/abonos`);
  const snapshot = await getDocs(ref);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Abono));
}

export async function crearAbono(clienteId: string, deudorId: string, abono: Abono) {
  const ref = collection(db, `clientes/${clienteId}/deudores/${deudorId}/abonos`);
  await addDoc(ref, abono);
}

export async function actualizarAbono(clienteId: string, deudorId: string, abono: Abono) {
  if (!abono.id) return;
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}/abonos/${abono.id}`);
  await updateDoc(ref, cleanAbono(abono));
}

export async function eliminarAbono(clienteId: string, deudorId: string, abonoId: string) {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}/abonos/${abonoId}`);
  await deleteDoc(ref);
}

function cleanAbono(abono: Abono): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key in abono) {
    const value = (abono as any)[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}