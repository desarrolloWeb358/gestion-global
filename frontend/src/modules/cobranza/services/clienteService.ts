import { db } from "../../../firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { Cliente } from "../models/cliente.model";

// Referencia a la colección en Firestore
const clientesRef = collection(db, "clientes");

// Obtener todos los clientes
export const obtenerClientes = async (): Promise<Cliente[]> => {
  const snapshot = await getDocs(clientesRef);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Cliente));
};

// Crear un nuevo cliente
export const crearCliente = async (cliente: Omit<Cliente, "id">): Promise<void> => {
  await addDoc(clientesRef, cliente);
};

// Actualizar cliente existente
export const actualizarCliente = async (cliente: Cliente): Promise<void> => {
  const { id, ...data } = cliente;
  if (!id) return;
  const ref = doc(db, "clientes", id);
  await updateDoc(ref, data);
};

// Eliminar cliente por ID
export const eliminarCliente = async (id: string): Promise<void> => {
  const ref = doc(db, "clientes", id);
  await deleteDoc(ref);
};
