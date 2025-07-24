import { db, auth } from "../../../firebase"; // asegúrate de importar auth también
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
import { Cliente } from "../../cobranza/models/cliente.model"; // Asegúrate de importar esto

export const obtenerUsuarios = async (): Promise<UsuarioSistema[]> => {
  const snapshot = await getDocs(collection(db, "usuarios"));
  return snapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data(),
  } as UsuarioSistema));
};

/**
 * Crea un nuevo usuario en Firebase Auth y lo registra en Firestore
 */
export const crearUsuario = async (usuario: UsuarioSistema & { password: string }): Promise<void> => {
  const cred = await createUserWithEmailAndPassword(auth, usuario.email, usuario.password);
  const uid = cred.user.uid;

  const ref = doc(db, "usuarios", uid);

  const usuarioFirestore: UsuarioSistema = {
    uid,
    email: usuario.email,
    roles: usuario.roles, // ✅ arreglo completo
    nombre: usuario.nombre ?? "",
    fecha_registro: serverTimestamp(),
    activo: true,
  };

  await setDoc(ref, usuarioFirestore);

  // ✅ Si incluye el rol "cliente", crear también en colección clientes
  if (usuario.roles.includes("cliente")) {
    const clienteRef = doc(db, "clientes", uid);
    const clienteData: Cliente = {
      id: uid,
      nombre: usuario.nombre ?? "",
      correo: usuario.email,
      direccion: "",
      ejecutivoId: "",
      telefono: "",
      banco: '',
      numeroCuenta: '',
      tipoCuenta: '',
    };
    await setDoc(clienteRef, clienteData);
  }
  if (usuario.roles.includes("cliente")) {
  const clienteRef = doc(db, "clientes", uid);
  const clienteData: Cliente = {
    id: uid,
    nombre: usuario.nombre ?? "",
    correo: usuario.email,
    direccion: "",
    ejecutivoId: "",
    telefono: "",
    banco: '',
    numeroCuenta: '',
    tipoCuenta: '',
  };
  await setDoc(clienteRef, clienteData);
}
};


export const actualizarUsuario = async (usuario: UsuarioSistema): Promise<void> => {
  if (!usuario.uid) throw new Error("El UID del usuario es obligatorio");
  const ref = doc(db, "usuarios", usuario.uid);
 await updateDoc(ref, {
  nombre: usuario.nombre,
  email: usuario.email,
  roles: usuario.roles, // ✅ cambio aquí también
  activo: usuario.activo ?? true,
  fecha_registro: usuario.fecha_registro,
});

};

export const eliminarUsuario = async (uid: string): Promise<void> => {
  const ref = doc(db, "usuarios", uid);
  await deleteDoc(ref);
};
