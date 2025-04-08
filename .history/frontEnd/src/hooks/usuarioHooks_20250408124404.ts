// src/services/usuarioHooks.ts
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { UsuarioSistema } from "../models/usuario.model";

const collectionRef = collection(db, "usuarios");

export const obtenerUsuarios = async (): Promise<UsuarioSistema[]> => {
  const snapshot = await getDocs(collectionRef);
  return snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() } as UsuarioSistema));
};

export const crearUsuario = async (usuario: UsuarioSistema) => {
  await addDoc(collectionRef, {
    ...usuario,
    fecha_registro: new Date().toISOString(),
  });
};

export const actualizarUsuario = async (usuario: UsuarioSistema) => {
  const { uid, ...datos } = usuario;
  const ref = doc(db, "usuarios", uid);
  await updateDoc(ref, datos);
};

export const eliminarUsuario = async (uid: string) => {
  const ref = doc(db, "usuarios", uid);
  await deleteDoc(ref);
};
