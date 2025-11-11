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
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { Seguimiento } from "../models/seguimiento.model";

/* ====================== Helpers ====================== */

// Sube el archivo y retorna la URL de descarga
async function uploadArchivo(
  clienteId: string,
  deudorId: string,
  archivo: File
): Promise<string> {
  const sref = ref(
    storage,
    `clientes/${clienteId}/deudores/${deudorId}/seguimientos/${Date.now()}_${archivo.name}`
  );
  await uploadBytes(sref, archivo);
  return getDownloadURL(sref);
}

// Elimina por URL completa (https://... o gs://...) de forma segura
async function safeDeleteByUrl(url?: string) {
  if (!url) return;
  try {
    const sref = ref(storage, url); // Firebase acepta URL completa
    await deleteObject(sref);
  } catch (e) {
    console.warn("No se pudo borrar el archivo de Storage:", e);
  }
}

// Remueve keys con valor undefined (evita errores en Firestore)
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

/* ======================================================
   PRE-JURÍDICO
   clientes/{clienteId}/deudores/{deudorId}/seguimiento
   ====================================================== */

export async function getSeguimientos(
  clienteId: string,
  deudorId: string
): Promise<Seguimiento[]> {
  const refCol = collection(db, `clientes/${clienteId}/deudores/${deudorId}/seguimiento`);
  const snap = await getDocs(refCol);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Seguimiento) }));
}

export async function addSeguimiento(
  ejecutivoUID: string,
  clienteId: string,
  deudorId: string,
  data: Omit<Seguimiento, "id">,
  archivo?: File
) {
  let archivoUrl = data.archivoUrl;
  if (archivo) {
    archivoUrl = await uploadArchivo(clienteId, deudorId, archivo);
  }

  const refCol = collection(db, `clientes/${clienteId}/deudores/${deudorId}/seguimiento`);
  console.log("se adiciona seguimiento con data:", data);

  const payload = stripUndefined({
    fecha: data.fecha ?? Timestamp.fromDate(new Date()),
    fechaCreacion: Timestamp.fromDate(new Date()),
    clienteUID: clienteId,
    ejecutivoUID: ejecutivoUID,
    tipoSeguimiento: data.tipoSeguimiento,
    descripcion: data.descripcion,
    ...(archivoUrl ? { archivoUrl } : {}),
  });

  return addDoc(refCol, payload);
}

export async function updateSeguimiento(
  clienteId: string,
  deudorId: string,
  seguimientoId: string,
  data: Omit<Seguimiento, "id">,
  archivo?: File,
  reemplazar?: boolean
) {
  const refDocu = doc(db, `clientes/${clienteId}/deudores/${deudorId}/seguimiento/${seguimientoId}`);

  // Resolver mutación de archivo:
  // - Si hay archivo nuevo:
  //    * si había anterior y "reemplazar", primero bórralo
  //    * sube el nuevo y setea archivoUrl
  // - Si NO hay archivo nuevo:
  //    * si "reemplazar" true ⇒ eliminar archivoUrl (deleteField)
  //    * de lo contrario, NO tocar archivoUrl
  let nuevoArchivoUrl: string | undefined;

  if (archivo) {
    if (data.archivoUrl && reemplazar) {
      await safeDeleteByUrl(data.archivoUrl);
    }
    nuevoArchivoUrl = await uploadArchivo(clienteId, deudorId, archivo);
  }

  const payloadBase = stripUndefined({
    fecha: data.fecha, // si viene undefined, no se envía
    tipoSeguimiento: data.tipoSeguimiento,
    descripcion: data.descripcion,
  });

  const payloadArchivo =
    archivo
      ? { archivoUrl: nuevoArchivoUrl } // se setea nuevo
      : reemplazar
        ? { archivoUrl: deleteField() } // se elimina explícitamente
        : {}; // no se toca el campo

  const payload = { ...payloadBase, ...payloadArchivo };

  return updateDoc(refDocu, payload);
}

export async function deleteSeguimiento(
  clienteId: string,
  deudorId: string,
  seguimientoId: string
) {
  const refDocu = doc(db, `clientes/${clienteId}/deudores/${deudorId}/seguimiento/${seguimientoId}`);
  const snap = await getDoc(refDocu);
  if (snap.exists()) {
    const d = snap.data() as Seguimiento;
    await safeDeleteByUrl(d.archivoUrl);
  }
  return deleteDoc(refDocu);
}

/* ======================================================
   JURÍDICO
   clientes/{clienteId}/deudores/{deudorId}/seguimientoJuridico
   ====================================================== */

export async function getSeguimientosJuridico(
  clienteId: string,
  deudorId: string
): Promise<Seguimiento[]> {
  const refCol = collection(db, `clientes/${clienteId}/deudores/${deudorId}/seguimientoJuridico`);
  const snap = await getDocs(refCol);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Seguimiento) }));
}

export async function addSeguimientoJuridico(
  ejecutivoUID: string,
  clienteId: string,
  deudorId: string,
  data: Omit<Seguimiento, "id">,
  archivo?: File
) {
  let archivoUrl = data.archivoUrl;
  if (archivo) {
    archivoUrl = await uploadArchivo(clienteId, deudorId, archivo);
  }

  const refCol = collection(db, `clientes/${clienteId}/deudores/${deudorId}/seguimientoJuridico`);

  const payload = stripUndefined({
    fecha: data.fecha ?? Timestamp.fromDate(new Date()),
    fechaCreacion: Timestamp.fromDate(new Date()),
    ejecutivoUID: ejecutivoUID,
    clienteUID: clienteId,
    tipoSeguimiento: data.tipoSeguimiento,
    descripcion: data.descripcion,
    ...(archivoUrl ? { archivoUrl } : {}),
  });

  return addDoc(refCol, payload);
}

export async function updateSeguimientoJuridico(
  clienteId: string,
  deudorId: string,
  seguimientoId: string,
  data: Omit<Seguimiento, "id">,
  archivo?: File,
  reemplazar?: boolean
) {
  const refDocu = doc(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/seguimientoJuridico/${seguimientoId}`
  );

  let nuevoArchivoUrl: string | undefined;

  if (archivo) {
    if (data.archivoUrl && reemplazar) {
      await safeDeleteByUrl(data.archivoUrl);
    }
    nuevoArchivoUrl = await uploadArchivo(clienteId, deudorId, archivo);
  }

  const payloadBase = stripUndefined({
    fecha: data.fecha,
    tipoSeguimiento: data.tipoSeguimiento,
    descripcion: data.descripcion,
  });

  const payloadArchivo =
    archivo
      ? { archivoUrl: nuevoArchivoUrl }
      : reemplazar
        ? { archivoUrl: deleteField() }
        : {};

  const payload = { ...payloadBase, ...payloadArchivo };

  return updateDoc(refDocu, payload);
}

export async function deleteSeguimientoJuridico(
  clienteId: string,
  deudorId: string,
  seguimientoId: string
) {
  const refDocu = doc(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/seguimientoJuridico/${seguimientoId}`
  );
  const snap = await getDoc(refDocu);
  if (snap.exists()) {
    const d = snap.data() as Seguimiento;
    await safeDeleteByUrl(d.archivoUrl);
  }
  return deleteDoc(refDocu);
}
