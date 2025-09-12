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
import { Cliente } from "../../cobranza/models/cliente.model";

/* ============================================
   Utilidad: elimina claves con undefined
   ============================================ */
const sanitize = <T extends Record<string, any>>(obj: T) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

/* ============================================
   Obtener TODOS los usuarios
   ============================================ */
export const obtenerUsuarios = async (): Promise<UsuarioSistema[]> => {
  const snapshot = await getDocs(collection(db, "usuarios"));
  return snapshot.docs.map(
    (d) =>
      ({
        uid: d.id,
        ...d.data(),
      } as UsuarioSistema)
  );
};

/* ============================================
   Obtener un usuario por UID (lo que necesitas)
   ============================================ */
export const getUsuarioByUid = async (uid: string): Promise<UsuarioSistema | null> => {
  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { uid, ...(snap.data() as Omit<UsuarioSistema, "uid">) };
};

/* ============================================
   (Opcional) Buscar usuario por documento
   ============================================ */
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
  // Crear en Firebase Auth
  const cred = await createUserWithEmailAndPassword(auth, usuario.email, usuario.password);
  const uid = cred.user.uid;

  // Documento del usuario en Firestore
  const usuarioFirestore: UsuarioSistema = {
    uid,
    email: usuario.email,
    nombre: usuario.nombre ?? "",
    telefonoUsuario: usuario.telefonoUsuario,
    tipoDocumento: usuario.tipoDocumento,
    numeroDocumento: usuario.numeroDocumento,
    roles: usuario.roles,
    activo: true,
    fecha_registro: serverTimestamp(),
  };

  await setDoc(doc(db, "usuarios", uid), usuarioFirestore);

  // Si el usuario también es "cliente", crear el doc en "clientes"
  if (usuario.roles.includes("cliente" as any)) {
    const clienteData: Cliente = {
      id: uid,                       // relaciona 1:1 con el usuario
      nombre: usuario.nombre ?? "",
      direccion: "",
      banco: "",
      numeroCuenta: "",
      tipoCuenta: "",
      ejecutivoPrejuridicoId: "",
      ejecutivoJuridicoId: "",
      activo: true as any,           // ajusta si tu modelo lo requiere
      // usuarioUid: uid,            // si tu modelo Cliente guarda el usuario
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
