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
// Guarda referencia al usuario por uid. NO guarda 'nombre'.
// ===============================
export function crearClienteDesdeUsuario(usuario: UsuarioSistema): Omit<Cliente, "id"> {
  return {
    // datos propios del cliente (sin nombre)
    direccion: "",
    banco: "",
    numeroCuenta: "",
    // evita escribir undefined: si no hay tipo, no lo incluyas al guardar
    // tipoCuenta: "", // opcional si quieres inicializar explícito
    ejecutivoPrejuridicoId: null,
    ejecutivoJuridicoId: null,
    activo: usuario.activo ?? true,
    // referencia al usuario dueño (de aquí sale el nombre/telefono/email)
    usuarioUid: usuario.uid ?? null,
  };
}

// ===============================
// Obtener 1 cliente
// ===============================
export async function getClienteById(clienteId: string): Promise<Cliente | null> {
  const ref = doc(db, "clientes", clienteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Cliente, "id">) };
}

export const setUsuarioClinte = async (clienteId: string, uid: string | null) => {
  const ref = doc(db, "clientes", clienteId); 
  await updateDoc(ref, { usuarioUid: uid });
}
// ===============================
// Obtener todos los clientes
// ===============================
export const obtenerClientes = async (): Promise<Cliente[]> => {
  const snapshot = await getDocs(clientesRef);
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Cliente, "id">) }));
};

// ===============================
// Crear nuevo cliente (id autogenerado)
// ===============================
export const crearCliente = async (cliente: Omit<Cliente, "id">): Promise<string> => {
  // NUNCA guardar 'nombre' aquí
  const { nombre, ...rest } = cliente as any;
  const clean = sanitize(rest);
  const ref = await addDoc(clientesRef, clean);
  return ref.id;
};

// ===============================
// Crear/Guardar cliente con un id específico (p. ej. el uid del usuario)
// ===============================
export const crearClienteConUid = async (uid: string, cliente: Omit<Cliente, "id">): Promise<void> => {
  // NUNCA guardar 'nombre' aquí
  const { nombre, ...rest } = cliente as any;
  const clean = sanitize(rest);
  // Evita guardar un campo 'id' duplicado dentro del doc
  await setDoc(doc(db, "clientes", uid), clean);
};

// ===============================
// Actualizar cliente
// ===============================
export async function actualizarCliente(id: string, data: Partial<Cliente>) {
  // Blindaje: jamás permitir 'nombre' en updates de clientes
  const { nombre, ...safe } = (data ?? {}) as any;

  // Si el tipo de cuenta viene como "" (vacío), no lo guardes para no ensuciar el doc
  if (safe.tipoCuenta === "") delete safe.tipoCuenta;

  const ref = doc(db, "clientes", id);
  const clean = sanitize(safe);
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
// Hidratación opcional: une clientes con usuarios
// ===============================
export type ClienteView = Cliente & {
  usuario?: Pick<
    UsuarioSistema,
    "uid" | "email" | "nombre"  | "tipoDocumento" | "numeroDocumento"
  >;
};

export function hidratarClientesConUsuarios(clientes: Cliente[], usuarios: UsuarioSistema[]): ClienteView[] {
  return clientes.map((c) => {
    const uid = c.usuarioUid ?? c.id; // fallback si el doc clientes usa el mismo id que el uid
    const usuario = usuarios.find((u) => u.uid === uid);
    return usuario
      ? {
          ...c,
          usuario: {
            uid: usuario.uid,
            email: usuario.email,
            nombre: usuario.nombre ?? "",
            telefono: (usuario as any).telefono, // asegúrate que tu modelo tenga 'telefono'
            tipoDocumento: (usuario as any).tipoDocumento,
            numeroDocumento: (usuario as any).numeroDocumento,
          },
        }
      : { ...c };
  });
}
