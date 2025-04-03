import { db } from "../../firebase";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { Cliente } from "../models/cliente.model";

const clientesRef = collection(db, "clientes");

export const getClientes = async (): Promise<Cliente[]> => {
  const snapshot = await getDocs(clientesRef);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Cliente));
};

export const addCliente = async (nuevo: Omit<Cliente, "id">) => {
  return await addDoc(clientesRef, nuevo);
};

export const updateCliente = async (id: string, data: Partial<Cliente>) => {
  const ref = doc(clientesRef, id);
  return await updateDoc(ref, data);
};

export const deleteCliente = async (id: string) => {
  const ref = doc(clientesRef, id);
  return await deleteDoc(ref);
};
