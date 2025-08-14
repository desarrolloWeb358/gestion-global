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
import { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";

// Referencia a la colección en Firestore
const clientesRef = collection(db, "clientes");

/**
 * Transforma un usuario con rol "cliente" en una estructura Cliente base
 */
export function crearClienteDesdeUsuario(usuario: UsuarioSistema): Cliente {
  return {
    uid: usuario.uid,
    email: usuario.email,
    nombre: usuario.nombre,
    tipoDocumento: usuario.tipoDocumento,
    numeroDocumento: usuario.numeroDocumento,
    telefonoUsuario: usuario.telefonoUsuario,
    ejecutivoJuridicoId: "",
    ejecutivoPrejuridicoId: "",
    direccion: "",
    banco: "",
    numeroCuenta: "",
    tipoCuenta: "",
    fecha_registro: usuario.fecha_registro,
    activo: usuario.activo ?? true,
    roles: ["cliente"],  };
}

/**
 * Obtener todos los clientes registrados
 */
export const obtenerClientes = async (): Promise<Cliente[]> => {
  const snapshot = await getDocs(clientesRef);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Cliente));
};

/**
 * Crear un nuevo cliente a partir del objeto Cliente
 */
export const crearCliente = async (cliente: Omit<Cliente, "id">): Promise<void> => {
  await addDoc(clientesRef, cliente);
};

/**
 * Actualizar cliente existente
 */
export async function actualizarCliente(id: string, data: Partial<Cliente>) {
  const ref = doc(db, "clientes", id);
  // Limpia undefined si corresponde
  return updateDoc(ref, data as any);
}

/**
 * Eliminar cliente por ID
 */
export const eliminarCliente = async (id: string): Promise<void> => {
  const ref = doc(db, "clientes", id);
  await deleteDoc(ref);
};
