import { db } from "@/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { Cliente } from "@/modules/clientes/models/cliente.model";
import { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";

// ===============================
// Colección
// ===============================
const clientesRef = collection(db, "clientes");

// ===============================
// Utilidades
// ===============================
const sanitize = <T extends Record<string, any>>(obj: T) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

// ===============================
// Crear Cliente desde UsuarioSistema (sin duplicar datos de usuario)
// Guarda referencia al usuario por uid y deja campos del cliente vacíos
// ===============================
export function crearClienteDesdeUsuario(usuario: UsuarioSistema): Cliente {
  return {
    // si quieres que el id del doc "clientes" sea el mismo uid del usuario, usa setDoc con {id: usuario.uid}
    nombre: usuario.nombre ?? "",
    direccion: "",
    banco: "",
    numeroCuenta: "",
    tipoCuenta: undefined, // o null si tu modelo lo permite
    ejecutivoPrejuridicoId: null,
    ejecutivoJuridicoId: null,
    activo: usuario.activo ?? true,
    // referencia al usuario dueño (recomendado):
    usuarioUid: usuario.uid, // <-- agrega este campo en tu Cliente model
    // fecha_registro: puedes no duplicarla aquí; la del usuario ya existe en "usuarios"
  };
}
export async function getClienteById(clienteId: string): Promise<Cliente | null> {
  const ref = doc(db, "clientes", clienteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Cliente, "id">) };
}
// ===============================
// Obtener todos los clientes (base, sin hidratar)
// ===============================
export const obtenerClientes = async (): Promise<Cliente[]> => {
  const snapshot = await getDocs(clientesRef);
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Cliente) }));
};

// ===============================
// Crear nuevo cliente (id autogenerado)
// ===============================
export const crearCliente = async (cliente: Omit<Cliente, "id">): Promise<string> => {
  const clean = sanitize(cliente);
  const ref = await addDoc(clientesRef, clean);
  return ref.id;
};

// ===============================
// Crear/Guardar cliente con un id específico (p. ej. el uid del usuario)
// ===============================
export const crearClienteConUid = async (uid: string, cliente: Omit<Cliente, "id">): Promise<void> => {
  const clean = sanitize(cliente);
  await setDoc(doc(db, "clientes", uid), { ...clean, id: uid });
};

// ===============================
// Actualizar cliente
// ===============================
export async function actualizarCliente(id: string, data: Partial<Cliente>) {
  const ref = doc(db, "clientes", id);
  const clean = sanitize(data);
  return updateDoc(ref, clean as any);
}

// ===============================
// Eliminar cliente
// ===============================
export const eliminarCliente = async (id: string): Promise<void> => {
  const ref = doc(db, "clientes", id);
  await deleteDoc(ref);
};

// ===============================
// Hidratación opcional: une clientes con usuarios para mostrar email/teléfono/documento sin guardarlos duplicados
// ===============================
export type ClienteView = Cliente & {
  usuario?: Pick<UsuarioSistema, "uid" | "email" | "nombre" | "telefonoUsuario" | "tipoDocumento" | "numeroDocumento">;
};

export function hidratarClientesConUsuarios(clientes: Cliente[], usuarios: UsuarioSistema[]): ClienteView[] {
  return clientes.map((c) => {
    const uid = c.usuarioUid ?? c.id; // si usas el mismo id del doc que el uid del usuario
    const usuario = usuarios.find((u) => u.uid === uid);
    return usuario ? { ...c, usuario: {
      uid: usuario.uid,
      email: usuario.email,
      nombre: usuario.nombre ?? "",
      telefonoUsuario: usuario.telefonoUsuario,
      tipoDocumento: usuario.tipoDocumento,
      numeroDocumento: usuario.numeroDocumento,
    }} : { ...c };
  });
}
