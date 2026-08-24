// modules/casos/services/clienteParticularService.ts
//
// CRUD de `clientesParticulares`. Colección raíz nueva: ninguna consulta del
// negocio de cartera (clientes / deudores / demandas) la toca.
import { db } from "@/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { storage } from "@/firebase";
import { registrarEliminacion } from "@/shared/services/auditLog/auditLogService";
import { franquiciasVisibles, type Rol } from "@/shared/constants/acl";
import type { ClienteParticular } from "../models/clienteParticular.model";

const COLECCION = "clientesParticulares";

function colRef() {
  return collection(db, COLECCION);
}

function docRef(id: string) {
  return doc(db, COLECCION, id);
}

const sanitize = <T extends Record<string, any>>(obj: T) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

function mapDoc(id: string, data: any): ClienteParticular {
  return {
    id,
    tipoPersona: data.tipoPersona === "juridica" ? "juridica" : "natural",
    nombre: data.nombre ?? "",
    tipoDocumento: data.tipoDocumento ?? undefined,
    numeroDocumento: data.numeroDocumento ?? "",
    representanteLegal: data.representanteLegal ?? "",
    telefonos: Array.isArray(data.telefonos) ? data.telefonos : [],
    direccion: data.direccion ?? "",
    franquiciaId: data.franquiciaId ?? undefined,
    ciudad: data.ciudad ?? undefined,
    abogadoId: data.abogadoId ?? null,
    dependienteId: data.dependienteId ?? null,
    activo: data.activo !== false,
    fechaCreacion: data.fechaCreacion ?? null,
    fechaActualizacion: data.fechaActualizacion ?? null,
  };
}

export type ClienteParticularInput = Omit<
  ClienteParticular,
  "id" | "fechaCreacion" | "fechaActualizacion"
>;

/**
 * Crea el documento con el UID del usuario como id (misma convención que
 * `clientes/{uid}`). Se invoca justo después de crear el usuario con rol
 * `clienteCaso` desde la pantalla de Usuarios.
 */
export async function crearClienteParticularConUid(
  uid: string,
  data: ClienteParticularInput
): Promise<void> {
  await setDoc(
    docRef(uid),
    {
      ...sanitize(data as Record<string, any>),
      activo: data.activo ?? true,
      fechaCreacion: serverTimestamp(),
      fechaActualizacion: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getClienteParticularById(
  id: string
): Promise<ClienteParticular | null> {
  const snap = await getDoc(docRef(id));
  return snap.exists() ? mapDoc(snap.id, snap.data()) : null;
}

/**
 * Lista los clientes particulares aplicando el mismo alcance por franquicia
 * que ya usa `obtenerClientesPorUsuario` para los conjuntos.
 */
export async function obtenerClientesParticulares(params: {
  roles: Rol[];
  franquiciasAsignadas?: string[];
}): Promise<ClienteParticular[]> {
  const snap = await getDocs(query(colRef(), orderBy("nombre", "asc")));
  let items = snap.docs.map((d) => mapDoc(d.id, d.data()));

  const alcance = franquiciasVisibles({
    roles: params.roles,
    franquiciasAsignadas: params.franquiciasAsignadas,
  });
  if (alcance !== "ALL") {
    const permitidas = new Set(alcance);
    items = items.filter((c) => !!c.franquiciaId && permitidas.has(c.franquiciaId));
  }

  return items;
}

export async function actualizarClienteParticular(
  id: string,
  patch: Partial<ClienteParticularInput>
): Promise<void> {
  await updateDoc(docRef(id), {
    ...sanitize(patch as Record<string, any>),
    fechaActualizacion: serverTimestamp(),
  } as any);
}

async function borrarArchivoSiExiste(path?: string) {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (e) {
    console.warn("No se pudo borrar el archivo de Storage:", e);
  }
}

/**
 * Borra el cliente y todos sus casos, incluyendo seguimiento, observaciones y
 * los archivos que cuelgan de ellos en Storage.
 * No toca el usuario de Auth: eso se hace desde Usuarios.
 */
export async function eliminarClienteParticular(id: string): Promise<void> {
  const cliente = await getClienteParticularById(id);

  const casosSnap = await getDocs(collection(db, `${COLECCION}/${id}/casos`));
  for (const casoDoc of casosSnap.docs) {
    // Archivos de las subcolecciones (adjuntos de seguimiento y observaciones)
    for (const sub of ["seguimiento", "observaciones"]) {
      const subSnap = await getDocs(collection(db, `${casoDoc.ref.path}/${sub}`));
      if (subSnap.empty) continue;

      for (const d of subSnap.docs) {
        await borrarArchivoSiExiste((d.data() as any)?.archivoPath);
      }
      const batch = writeBatch(db);
      subSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // Documentos del caso
    const documentos = (casoDoc.data() as any)?.documentos ?? [];
    for (const doc of documentos) {
      await borrarArchivoSiExiste(doc?.path);
    }

    await deleteDoc(casoDoc.ref);
  }

  await deleteDoc(docRef(id));
  await registrarEliminacion({
    modulo: "clienteParticular",
    descripcion: cliente?.nombre ?? id,
    coleccionPath: COLECCION,
  });
}
