import { db } from "../../../firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { Cliente } from "../../../models/cliente.model";

const clientesRef = collection(db, "clientes");

export const obtenerClientes = async (): Promise<Cliente[]> => {
  const snapshot = await getDocs(clientesRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente));
};

export const crearCliente = async (cliente: Omit<Cliente, "id">) => {
  await addDoc(clientesRef, {
    ...cliente,
    fecha_creacion: new Date().toISOString(),
  });
};

export const actualizarCliente = async (cliente: Cliente) => {
  const { id, ...data } = cliente;
  if (!id) return;
  const ref = doc(db, "clientes", id);
  await updateDoc(ref, data);
};

export const eliminarCliente = async (id: string) => {
  const ref = doc(db, "clientes", id);
  await deleteDoc(ref);
};
