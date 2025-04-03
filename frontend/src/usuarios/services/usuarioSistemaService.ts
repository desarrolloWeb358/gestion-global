import { db } from "../../firebase";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { UsuarioSistema } from "../models/usuarioSistema.model";

const usuariosRef = collection(db, "usuariosSistema");

export const getUsuariosSistema = async (): Promise<UsuarioSistema[]> => {
  const snapshot = await getDocs(usuariosRef);
  return snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() } as UsuarioSistema));
};

export const addUsuarioSistema = async (nuevo: Omit<UsuarioSistema, "uid">) => {
  return await addDoc(usuariosRef, nuevo);
};

export const updateUsuarioSistema = async (uid: string, data: Partial<UsuarioSistema>) => {
  const ref = doc(usuariosRef, uid);
  return await updateDoc(ref, data);
};

export const deleteUsuarioSistema = async (uid: string) => {
  const ref = doc(usuariosRef, uid);
  return await deleteDoc(ref);
};