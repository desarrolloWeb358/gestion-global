import { db } from "../../firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
} from "firebase/firestore";
import { Usuario } from "../models/usuario.model";

const usuariosRef = collection(db, "usuarios");

export const getUsuarios = async (): Promise<Usuario[]> => {
  const snapshot = await getDocs(usuariosRef);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Usuario[];
};

export const addUsuario = async (usuario: Omit<Usuario, "id">) => {
  await addDoc(usuariosRef, usuario);
};

export const updateUsuario = async (id: string, data: Partial<Usuario>) => {
  const usuarioDoc = doc(db, "usuarios", id);
  await updateDoc(usuarioDoc, data);
};

export const deleteUsuario = async (id: string) => {
  const usuarioDoc = doc(db, "usuarios", id);
  await deleteDoc(usuarioDoc);
};
