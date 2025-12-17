// src/modules/usuarios/services/usuarioService.ts
import { db, auth } from "../../../firebase";
import {
  collection,
  doc,
  getDoc,          // ⬅️ añadido
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,           // ⬅️ opcional (para búsqueda por documento)
  where,           // ⬅️ opcional (para búsqueda por documento)
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { UsuarioSistema } from "../models/usuarioSistema.model";
import { Cliente } from "@/modules/clientes/models/cliente.model";

/* ============================================
   Utilidad: elimina claves con undefined
   ============================================ */
const sanitize = <T extends Record<string, any>>(obj: T) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;


// 👇 helper interno
const mapDocToUsuario = (d: any): UsuarioSistema =>
({
  uid: d.id,
  ...d.data(),
} as UsuarioSistema);

/* ============================================
   Obtener TODOS los usuarios
   ============================================ */
export const obtenerUsuarios = async (): Promise<UsuarioSistema[]> => {
  const snapshot = await getDocs(collection(db, "usuarios"));
  return snapshot.docs.map(mapDocToUsuario);
};

/* ============================================
   Obtener usuarios por rol (ejecutivo, abogado, etc.)
   ============================================ */
export const obtenerUsuariosPorRol = async (rol: string): Promise<UsuarioSistema[]> => {
  const q = query(
    collection(db, "usuarios"),
    where("roles", "array-contains", rol)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapDocToUsuario);
};

/* Helpers específicos (azúcar sintáctico) */
export const obtenerEjecutivos = () => obtenerUsuariosPorRol("ejecutivo");
export const obtenerAbogados = () => obtenerUsuariosPorRol("abogado");
export const obtenerDependientes = () => obtenerUsuariosPorRol("dependiente");



export const getUsuarioByUid = async (uid: string): Promise<UsuarioSistema | null> => {
  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { uid, ...(snap.data() as Omit<UsuarioSistema, "uid">) };
};

export const getUsuarioByDocumento = async (
  tipoDocumento: UsuarioSistema["tipoDocumento"],
  numeroDocumento: string
): Promise<UsuarioSistema | null> => {
  const q = query(
    collection(db, "usuarios"),
    where("tipoDocumento", "==", tipoDocumento),
    where("numeroDocumento", "==", numeroDocumento)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...(d.data() as Omit<UsuarioSistema, "uid">) };
};

/* ============================================
   Crear usuario (Auth + Firestore) y, si aplica, crear cliente
   ============================================ */
export const crearUsuario = async (
  usuario: UsuarioSistema & { password: string }
): Promise<string> => {
  const cred = await createUserWithEmailAndPassword(auth, usuario.email, usuario.password);
  const uid = cred.user.uid;

  const roles = Array.isArray(usuario.roles) ? usuario.roles : [];

  const usuarioFirestore: UsuarioSistema = {
    uid,
    email: usuario.email,
    nombre: usuario.nombre ?? "",
    telefonoUsuario: usuario.telefonoUsuario,
    tipoDocumento: usuario.tipoDocumento,
    numeroDocumento: usuario.numeroDocumento,
    roles,
    activo: true,
    fecha_registro: serverTimestamp(),
  };

  await setDoc(doc(db, "usuarios", uid), usuarioFirestore);

  // Si también es cliente, creamos el doc en "clientes"
  if (roles.includes("cliente" as any)) {
    const clienteData: Cliente = {
      id: uid,
      direccion: "",
      banco: "",
      numeroCuenta: "",
      tipoCuenta: "",
      nombre: usuario.nombre ?? "",
      ejecutivoPrejuridicoId: null as any,
      ejecutivoJuridicoId: null as any,
      ejecutivoDependienteId: null as any,
      abogadoId: null as any,
      activo: true as any,
    };

    await setDoc(doc(db, "clientes", uid), clienteData);
  }

  return uid;
};


/* ============================================
   Actualizar usuario
   ============================================ */
export const actualizarUsuario = async (usuario: UsuarioSistema): Promise<void> => {
  if (!usuario.uid) throw new Error("El UID del usuario es obligatorio");
  const ref = doc(db, "usuarios", usuario.uid);

  const updatePayload = sanitize({
    nombre: usuario.nombre,
    email: usuario.email,
    telefonoUsuario: usuario.telefonoUsuario,
    tipoDocumento: usuario.tipoDocumento,
    numeroDocumento: usuario.numeroDocumento,
    roles: usuario.roles,
    activo: usuario.activo ?? true,
    fecha_actualizacion: serverTimestamp(),
  });

  await updateDoc(ref, updatePayload as any);
};

/* ============================================
   Eliminar usuario
   ============================================ */
export const eliminarUsuario = async (uid: string): Promise<void> => {
  const ref = doc(db, "usuarios", uid);
  await deleteDoc(ref);
};
