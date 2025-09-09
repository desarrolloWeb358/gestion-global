// src/modules/usuarios/services/usuarioService.ts
import { db, auth } from "../../../firebase";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { UsuarioSistema } from "../models/usuarioSistema.model";
import { Cliente } from "@/modules/clientes/models/cliente.model";

// ============================================
// Obtener usuarios
// ============================================
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

// ============================================
// Crear usuario (Auth + Firestore) y, si aplica, crear cliente
// ============================================
export const crearUsuario = async (
  usuario: UsuarioSistema & { password: string }
): Promise<string> => {
  // Crear en Firebase Auth
  const cred = await createUserWithEmailAndPassword(
    auth,
    usuario.email,
    usuario.password
  );
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
    // buena práctica: puedes agregar fecha_actualizacion en updates
  };

  await setDoc(doc(db, "usuarios", uid), usuarioFirestore);

  // Si el usuario también es "cliente", crear el doc en "clientes"
  if (usuario.roles.includes("cliente")) {
    // ⚠️ Este modelo asume un Cliente "puro" (sin email/roles/uid propios de UsuarioSistema)
    const clienteData: Cliente = {
      id: uid,                       // usamos el mismo id para relacionar
      nombre: usuario.nombre ?? "",
      direccion: "",
      banco: "",
      numeroCuenta: "",
      tipoCuenta: "",                // "" o undefined según tu interfaz
      ejecutivoPrejuridicoId: "",
      ejecutivoJuridicoId: "",       // ✅ corregido el typo (J mayúscula)
      activo: true,                  // si existe en tu modelo
      // Si tu modelo de Cliente guarda referencia al usuario:
      // usuarioUid: uid,
    };

    await setDoc(doc(db, "clientes", uid), clienteData);
  }

  return uid;
};

// ============================================
// Actualizar usuario
// ============================================
export const actualizarUsuario = async (usuario: UsuarioSistema): Promise<void> => {
  if (!usuario.uid) throw new Error("El UID del usuario es obligatorio");
  const ref = doc(db, "usuarios", usuario.uid);

  // Utilidad: elimina claves con undefined (para no sobrescribir con undefined)
  const sanitize = <T extends Record<string, any>>(obj: T) =>
    Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== undefined)
    ) as Partial<T>;

  const updatePayload = sanitize({
    nombre: usuario.nombre,
    email: usuario.email,
    telefonoUsuario: usuario.telefonoUsuario, // ✅ ahora sí actualiza teléfono
    tipoDocumento: usuario.tipoDocumento,     // ✅ ahora sí actualiza tipo de doc
    numeroDocumento: usuario.numeroDocumento, // ✅ ahora sí actualiza número de doc
    roles: usuario.roles,
    activo: usuario.activo ?? true,
    fecha_actualizacion: serverTimestamp(),   // ✅ marca de actualización
  });

  await updateDoc(ref, updatePayload as any);
};

// ============================================
// Eliminar usuario
// ============================================
export const eliminarUsuario = async (uid: string): Promise<void> => {
  const ref = doc(db, "usuarios", uid);
  await deleteDoc(ref);
};
