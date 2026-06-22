// modules/cobranza/services/seguimientoDemandaService.ts
import { db, storage } from "../../../firebase";
import { registrarEliminacion } from "@/shared/services/auditLog/auditLogService";
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
 *  Campos: fecha, descripcion, archivoPath, archivoUrl
 *  ============================================ */
export interface SeguimientoDemanda {
  id?: string;
  fecha: Timestamp | Date;
  descripcion?: string;
  esInterno?: boolean;
  archivoPath?: string;
  archivoUrl?: string;
  actualizadoEn?: Timestamp;
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
  const path = `clientes/${clienteId}/deudores/${deudorId}/seguimientoDemanda/${Date.now()}_${archivo.name}`;
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
   Ruta: clientes/{clienteId}/deudores/{deudorId}/seguimientoDemanda
   ====================================================== */

export async function getSeguimientosDemanda(
  clienteId: string,
  deudorId: string
): Promise<SeguimientoDemanda[]> {
  const refCol = collection(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/seguimientoDemanda`
  );
  const snap = await getDocs(query(refCol, orderBy("fecha", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as SeguimientoDemanda) }));
}

export async function addSeguimientoDemanda(
  ejecutivoUID: string,
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
    `clientes/${clienteId}/deudores/${deudorId}/seguimientoDemanda`
  );

  const ahora = Timestamp.fromDate(new Date());
  const fechaSeleccionada = data.fecha instanceof Date
    ? Timestamp.fromDate(data.fecha)
    : (data.fecha ?? ahora);

  const payload = stripUndefined({
    fecha: fechaSeleccionada,
    ejecutivoUID: ejecutivoUID,
    clienteUID: clienteId,
    descripcion: data.descripcion,
    esInterno: !!data.esInterno,
    actualizadoEn: ahora,
    ...(archivoPath ? { archivoPath } : {}),
    ...(archivoUrl ? { archivoUrl } : {}),
  });

  const docRef = await addDoc(refCol, payload);

  // Siempre actualizar fechaUltimaRevision con la fecha real de creación (independiente de esInterno)
  const deudorRef = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  await updateDoc(deudorRef, { fechaUltimaRevision: ahora });

  return docRef;
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
    `clientes/${clienteId}/deudores/${deudorId}/seguimientoDemanda/${demandaId}`
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

  const fechaEdit = data.fecha instanceof Date
    ? Timestamp.fromDate(data.fecha)
    : data.fecha ?? undefined;

  const payloadBase = stripUndefined({
    fecha: fechaEdit,
    descripcion: data.descripcion,
    esInterno: !!data.esInterno,
    actualizadoEn: Timestamp.fromDate(new Date()),
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
    `clientes/${clienteId}/deudores/${deudorId}/seguimientoDemanda/${demandaId}`
  );
  const snap = await getDoc(refDocu);
  const data = snap.exists() ? (snap.data() as SeguimientoDemanda) : null;
  if (data?.archivoPath) {
    await safeDeleteByPath(data.archivoPath);
  }
  await deleteDoc(refDocu);
  await registrarEliminacion({
    modulo: "seguimientoDemanda",
    descripcion: data?.descripcion ?? demandaId,
    coleccionPath: `clientes/${clienteId}/deudores/${deudorId}/seguimientoDemanda`,
  });
}
