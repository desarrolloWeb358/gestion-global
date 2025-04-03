import { db } from "../../firebase";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { Inmueble } from "../models/inmueble.model";

export const getInmuebles = async (clienteId: string): Promise<Inmueble[]> => {
  const ref = collection(db, `clientes/${clienteId}/inmuebles`);
  const snapshot = await getDocs(ref);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Inmueble));
};

export const addInmueble = async (clienteId: string, nuevo: Omit<Inmueble, "id">) => {
  const ref = collection(db, `clientes/${clienteId}/inmuebles`);
  return await addDoc(ref, nuevo);
};

export const updateInmueble = async (clienteId: string, inmuebleId: string, data: Partial<Inmueble>) => {
  const ref = doc(db, `clientes/${clienteId}/inmuebles/${inmuebleId}`);
  return await updateDoc(ref, data);
};

export const deleteInmueble = async (clienteId: string, inmuebleId: string) => {
  const ref = doc(db, `clientes/${clienteId}/inmuebles/${inmuebleId}`);
  return await deleteDoc(ref);
};
