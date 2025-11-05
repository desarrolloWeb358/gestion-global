// modules/cobranza/services/seguimientoDemandaService.ts
import { db, storage } from "../../../firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  deleteField,
  query,
  orderBy,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

/** ============================================
 *  Modelo de Seguimiento de Demanda
 *  Campos: consecutivo, fecha, descripcion, archivoPath, archivoUrl
 *  ============================================ */
export interface SeguimientoDemanda {
  id?: string;
  consecutivo: string;
  fecha: Timestamp | Date;
  descripcion?: string;
  archivoPath?: string;
  archivoUrl?: string;
}

/* ====================== Helpers ====================== */

// Quita undefined para evitar sobrescrituras no deseadas en Firestore
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

// Sube archivo a Storage y retorna { path, url }
async function uploadArchivoDemanda(
  clienteId: string,
  deudorId: string,
  archivo: File
): Promise<{ path: string; url: string }> {
  const path = `clientes/${clienteId}/deudores/${deudorId}/seguimiento_demanda/${Date.now()}_${archivo.name}`;
  const sref = ref(storage, path);
  await uploadBytes(sref, archivo);
  const url = await getDownloadURL(sref);
  return { path, url };
}

// Borra por path (más robusto que intentar con URL)
async function safeDeleteByPath(path?: string) {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (e) {
    console.warn("No se pudo borrar el archivo de Storage:", e);
  }
}

/* ======================================================
   CRUD Seguimiento Demanda
   Ruta: clientes/{clienteId}/deudores/{deudorId}/seguimiento_demanda
   ====================================================== */

export async function getSeguimientosDemanda(
  clienteId: string,
  deudorId: string
): Promise<SeguimientoDemanda[]> {
  const refCol = collection(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/seguimiento_demanda`
  );
  const snap = await getDocs(query(refCol, orderBy("fecha", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as SeguimientoDemanda) }));
}

export async function addSeguimientoDemanda(
  clienteId: string,
  deudorId: string,
  data: Omit<SeguimientoDemanda, "id">,
  archivo?: File
) {
  let archivoPath = data.archivoPath;
  let archivoUrl = data.archivoUrl;

  if (archivo) {
    const up = await uploadArchivoDemanda(clienteId, deudorId, archivo);
    archivoPath = up.path;
    archivoUrl = up.url;
  }

  const refCol = collection(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/seguimiento_demanda`
  );

  const payload = stripUndefined({
    consecutivo: data.consecutivo,
    fecha: (data.fecha as any) ?? Timestamp.fromDate(new Date()),
    descripcion: data.descripcion,
    ...(archivoPath ? { archivoPath } : {}),
    ...(archivoUrl ? { archivoUrl } : {}),
  });

  return addDoc(refCol, payload);
}

export async function updateSeguimientoDemanda(
  clienteId: string,
  deudorId: string,
  demandaId: string,
  data: Omit<SeguimientoDemanda, "id">,
  archivo?: File,
  reemplazar?: boolean
) {
  const refDocu = doc(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/seguimiento_demanda/${demandaId}`
  );

  let newPath: string | undefined;
  let newUrl: string | undefined;

  if (archivo) {
    // si hay archivo previo y se decide reemplazar, se borra primero
    if (data.archivoPath && reemplazar) {
      await safeDeleteByPath(data.archivoPath);
    }
    const up = await uploadArchivoDemanda(clienteId, deudorId, archivo);
    newPath = up.path;
    newUrl = up.url;
  }

  const payloadBase = stripUndefined({
    consecutivo: data.consecutivo,
    fecha: data.fecha,
    descripcion: data.descripcion,
  });

  const payloadArchivo = archivo
    ? { archivoPath: newPath, archivoUrl: newUrl }
    : reemplazar
    ? { archivoPath: deleteField(), archivoUrl: deleteField() }
    : {};

  const payload = { ...payloadBase, ...payloadArchivo };
  return updateDoc(refDocu, payload);
}

export async function deleteSeguimientoDemanda(
  clienteId: string,
  deudorId: string,
  demandaId: string
) {
  const refDocu = doc(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/seguimiento_demanda/${demandaId}`
  );
  const snap = await getDoc(refDocu);
  if (snap.exists()) {
    const d = snap.data() as SeguimientoDemanda;
    await safeDeleteByPath(d.archivoPath);
  }
  return deleteDoc(refDocu);
}
