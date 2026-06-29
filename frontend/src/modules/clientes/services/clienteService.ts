import { db } from "@/firebase";
import { registrarEliminacion } from "@/shared/services/auditLog/auditLogService";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  or, where,
  getDoc, orderBy, query
} from "firebase/firestore";
import { franquiciasVisibles, type Rol } from "@/shared/constants/acl";
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


export interface ClienteOption {
  id: string;
  nombre: string;
}

// ===============================
// Crear Cliente desde UsuarioSistema (sin duplicar datos de usuario)
// Guarda referencia al usuario por uid. NO guarda 'nombre'.
// ===============================
export function crearClienteDesdeUsuario(
  usuario: UsuarioSistema
): Omit<Cliente, "id"> {
  return {
    nombre: usuario.nombre ?? usuario.email ?? "",  // 👈 clave
    administrador: "", 
    direccion: "",
    formaPago: "",    
    ejecutivoPrejuridicoId: null,
    ejecutivoJuridicoId: null,
    ejecutivoDependienteId: null,
    abogadoId: null,
    dependienteAbogadoId: null,
    activo: usuario.activo ?? true,
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

export async function obtenerClientesPorUsuario(params: {
  uid: string;
  roles: Rol[];
  franquiciasAsignadas?: string[];
}): Promise<Cliente[]> {
  const { roles, franquiciasAsignadas } = params;

  // Todos ven todos los clientes EXCEPTO adminFranquicia, que se limita a sus franquicias.
  const qy = query(clientesRef, orderBy("nombre", "asc"));
  const snap = await getDocs(qy);
  let clientes = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Cliente[];

  const alcance = franquiciasVisibles({ roles, franquiciasAsignadas });
  if (alcance !== "ALL") {
    const permitidas = new Set(alcance);
    clientes = clientes.filter((c) => !!c.franquiciaId && permitidas.has(c.franquiciaId));
  }

  return clientes;

  /* despues se habilita nuevamente el control por roles

  const isAdmin =
    roles.includes("admin") || roles.includes("ejecutivoAdmin");

  if (isAdmin) {
    const qy = query(clientesRef, orderBy("nombre", "asc"));
    const snap = await getDocs(qy);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  // Abogado
  if (roles.includes("abogado")) {
    const qy = query(
      clientesRef,
      where("abogadoId", "==", uid),
      orderBy("nombre", "asc")
    );
    const snap = await getDocs(qy);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  // Dependiente (solo dependiente)
  if (roles.includes("dependiente") && !roles.includes("ejecutivo")) {
    const qy = query(
      clientesRef,
      where("ejecutivoDependienteId", "==", uid),
      orderBy("nombre", "asc")
    );
    const snap = await getDocs(qy);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  // Ejecutivo (OR entre 3 campos)
  if (roles.includes("ejecutivo") || roles.includes("dependiente")) {
    const qy = query(
      clientesRef,
      or(
        where("ejecutivoPrejuridicoId", "==", uid),
        where("ejecutivoJuridicoId", "==", uid),
        where("ejecutivoDependienteId", "==", uid)
      ),
      orderBy("nombre", "asc")
    );
    const snap = await getDocs(qy);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  // fallback: no roles que accedan a clientes
  return [];
  */
}

// Clientes accesibles según el rol — usado en búsquedas de WhatsApp
export async function listarClientesWhatsapp(
  uid: string,
  roles: Rol[]
): Promise<ClienteOption[]> {
  const isFullAccess =
    roles.includes("admin") ||
    roles.includes("supervisor") ||
    roles.includes("ejecutivoAdmin");

  const q = isFullAccess
    ? query(clientesRef, orderBy("nombre", "asc"))
    : query(
        clientesRef,
        where("ejecutivoPrejuridicoId", "==", uid),
        orderBy("nombre", "asc")
      );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    nombre: String((d.data() as any).nombre || d.id),
  }));
}

export const listarClientesBasico = async (): Promise<ClienteOption[]> => {
  // Si todos los clientes tienen `nombre`, usamos orderBy directo
  const qy = query(clientesRef, orderBy("nombre", "asc"));
  const snap = await getDocs(qy);

  const items: ClienteOption[] = snap.docs.map((d) => {
    const data = d.data() as any;
    const nombre =
      data.nombre ||
      d.id;

    return {
      id: d.id,
      nombre: String(nombre),
    };
  });

  // Si no puedes hacer orderBy("nombre") porque algunos no lo tienen,
  // puedes quitar el `orderBy` de la query y dejar este sort:
  // items.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

  return items;
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
  const { nombre, ...safe } = (data ?? {}) as any;

  const ref = doc(db, "clientes", id);
  const clean = sanitize(safe);
  await updateDoc(ref, clean as any);

  // Sincroniza activo → usuarios si cambia
  if (typeof data.activo === "boolean") {
    const usuarioRef = doc(db, "usuarios", id);
    const usuarioSnap = await getDoc(usuarioRef);
    if (usuarioSnap.exists()) {
      await updateDoc(usuarioRef, { activo: data.activo });
    }
  }
}

// ===============================
// Eliminar cliente
// ===============================
export const eliminarCliente = async (id: string): Promise<void> => {
  const ref = doc(db, "clientes", id);
  await deleteDoc(ref);
  await registrarEliminacion({
    modulo: "cliente",
    descripcion: `Cliente eliminado - ID: ${id}`,
    coleccionPath: "clientes",
  });
};

// ===============================
// Hidratación opcional: une clientes con usuarios
// ===============================
export type ClienteView = Cliente & {
  usuario?: Pick<
    UsuarioSistema,
    "uid" | "email" | "nombre" | "tipoDocumento" | "numeroDocumento"
  >;
};

export function hidratarClientesConUsuarios(clientes: Cliente[], usuarios: UsuarioSistema[]): ClienteView[] {
  return clientes.map((c) => {
    const uid = c.id; // fallback si el doc clientes usa el mismo id que el uid
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
