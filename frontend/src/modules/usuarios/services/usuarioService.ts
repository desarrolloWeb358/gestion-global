import { db } from "../../../firebase"; // ajusta la ruta según tu proyecto
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  DocumentData,
} from "firebase/firestore";
import { UsuarioSistema } from "../models/usuarioSistema.model";

/**
 * Obtiene todos los usuarios desde Firestore
 */
export const obtenerUsuarios = async (): Promise<UsuarioSistema[]> => {
  const snapshot = await getDocs(collection(db, "usuarios"));
  return snapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data(),
  } as UsuarioSistema));
};

/**
 * Crea un nuevo usuario en Firestore con el UID proporcionado
 */
export const crearUsuario = async (usuario: UsuarioSistema): Promise<void> => {
  if (!usuario.uid) throw new Error("El UID del usuario es obligatorio");
  const ref = doc(db, "usuarios", usuario.uid);
  await setDoc(ref, usuario);
};

/**
 * Actualiza un usuario existente en Firestore
 */
export const actualizarUsuario = async (usuario: UsuarioSistema): Promise<void> => {
  if (!usuario.uid) throw new Error("El UID del usuario es obligatorio");
  const ref = doc(db, "usuarios", usuario.uid);
  await updateDoc(ref, {
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    asociadoA: usuario.asociadoA ?? null,
    activo: usuario.activo ?? true,
  });
};

/**
 * Elimina un usuario de Firestore
 */
export const eliminarUsuario = async (uid: string): Promise<void> => {
  const ref = doc(db, "usuarios", uid);
  await deleteDoc(ref);
};
