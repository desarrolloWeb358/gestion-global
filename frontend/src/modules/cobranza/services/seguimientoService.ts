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
  orderBy,
  query,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
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
  const path = `clientes/${clienteId}/deudores/${deudorId}/seguimientos/${Date.now()}_${archivo.name}`;
  const sref = ref(storage, path);
  await uploadBytes(sref, archivo);
  return path;
}

async function uploadArchivos(
  clienteId: string,
  deudorId: string,
  archivos: File[]
): Promise<string[]> {
  return Promise.all(archivos.map((f) => uploadArchivo(clienteId, deudorId, f)));
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

async function actualizarFechaUltimoSeguimiento(
  clienteId: string,
  deudorId: string,
  ahora: Timestamp
): Promise<void> {
  const deudorRef = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  await updateDoc(deudorRef, { fechaUltimoSeguimiento: ahora });
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
  const q = query(refCol, orderBy("fecha", "desc")); // ✅ más reciente primero
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Seguimiento) }));
}

export async function addSeguimiento(
  ejecutivoUID: string,
  clienteId: string,
  deudorId: string,
  data: Omit<Seguimiento, "id">,
  archivos?: File[]
) {
  const archivosUrl =
    archivos && archivos.length > 0
      ? await uploadArchivos(clienteId, deudorId, archivos)
      : undefined;

  const refCol = collection(db, `clientes/${clienteId}/deudores/${deudorId}/seguimiento`);

  const fechaBase = data.fecha instanceof Date ? data.fecha : data.fecha?.toDate?.() ?? new Date();
  const fechaSeleccionada = Timestamp.fromDate(fechaBase);
  const ahora = Timestamp.fromDate(new Date());

  const payload = stripUndefined({
    fecha: fechaSeleccionada,
    clienteUID: clienteId,
    ejecutivoUID: ejecutivoUID,
    tipoSeguimiento: data.tipoSeguimiento,
    descripcion: data.descripcion,
    actualizadoEn: ahora,
    ...(archivosUrl ? { archivosUrl } : {}),
  });

  const docRef = await addDoc(refCol, payload);

  await actualizarFechaUltimoSeguimiento(clienteId, deudorId, ahora);

  return docRef;
}

export async function updateSeguimiento(
  clienteId: string,
  deudorId: string,
  seguimientoId: string,
  data: Omit<Seguimiento, "id">,
  archivos?: File[],
  reemplazar?: boolean
) {
  const refDocu = doc(db, `clientes/${clienteId}/deudores/${deudorId}/seguimiento/${seguimientoId}`);

  const hayNuevos = archivos && archivos.length > 0;
  let nuevasUrls: string[] | undefined;

  if (hayNuevos) {
    if (reemplazar && data.archivosUrl) {
      await Promise.all(data.archivosUrl.map(safeDeleteByUrl));
    }
    nuevasUrls = await uploadArchivos(clienteId, deudorId, archivos!);
  }

  const ahora = Timestamp.fromDate(new Date());

  const payloadBase = stripUndefined({
    fecha: data.fecha,
    tipoSeguimiento: data.tipoSeguimiento,
    descripcion: data.descripcion,
    actualizadoEn: ahora,
  });

  const payloadArchivo =
    hayNuevos
      ? { archivosUrl: nuevasUrls }
      : reemplazar
        ? { archivosUrl: deleteField() }
        : {};

  const payload = { ...payloadBase, ...payloadArchivo };

  await updateDoc(refDocu, payload);

  await actualizarFechaUltimoSeguimiento(clienteId, deudorId, ahora);
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
    if (d.archivosUrl) await Promise.all(d.archivosUrl.map(safeDeleteByUrl));
  }
  await deleteDoc(refDocu);
  await registrarEliminacion({
    modulo: "seguimientoPreJuridico",
    descripcion: snap.exists() ? (snap.data() as Seguimiento).descripcion : seguimientoId,
    coleccionPath: `clientes/${clienteId}/deudores/${deudorId}/seguimiento`,
  });
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
  const q = query(refCol, orderBy("fecha", "desc")); // ✅ más reciente primero
  const snap = await getDocs(q);
  //const snap = await getDocs(refCol);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Seguimiento) }));
}

export async function addSeguimientoJuridico(
  ejecutivoUID: string,
  clienteId: string,
  deudorId: string,
  data: Omit<Seguimiento, "id">,
  archivos?: File[]
) {
  const archivosUrl =
    archivos && archivos.length > 0
      ? await uploadArchivos(clienteId, deudorId, archivos)
      : undefined;

  const refCol = collection(db, `clientes/${clienteId}/deudores/${deudorId}/seguimientoJuridico`);

  const fechaBase = data.fecha instanceof Date ? data.fecha : data.fecha?.toDate?.() ?? new Date();
  const fechaSeleccionada = Timestamp.fromDate(fechaBase);
  const ahora = Timestamp.fromDate(new Date());

  const payload = stripUndefined({
    fecha: fechaSeleccionada,
    ejecutivoUID: ejecutivoUID,
    clienteUID: clienteId,
    tipoSeguimiento: data.tipoSeguimiento,
    descripcion: data.descripcion,
    actualizadoEn: ahora,
    ...(archivosUrl ? { archivosUrl } : {}),
  });

  const docRef = await addDoc(refCol, payload);

  await actualizarFechaUltimoSeguimiento(clienteId, deudorId, ahora);

  return docRef;
}

export async function updateSeguimientoJuridico(
  clienteId: string,
  deudorId: string,
  seguimientoId: string,
  data: Omit<Seguimiento, "id">,
  archivos?: File[],
  reemplazar?: boolean
) {
  const refDocu = doc(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/seguimientoJuridico/${seguimientoId}`
  );

  const hayNuevos = archivos && archivos.length > 0;
  let nuevasUrls: string[] | undefined;

  if (hayNuevos) {
    if (reemplazar && data.archivosUrl) {
      await Promise.all(data.archivosUrl.map(safeDeleteByUrl));
    }
    nuevasUrls = await uploadArchivos(clienteId, deudorId, archivos!);
  }

  const ahora = Timestamp.fromDate(new Date());

  const payloadBase = stripUndefined({
    fecha: data.fecha,
    tipoSeguimiento: data.tipoSeguimiento,
    descripcion: data.descripcion,
    actualizadoEn: ahora,
  });

  const payloadArchivo =
    hayNuevos
      ? { archivosUrl: nuevasUrls }
      : reemplazar
        ? { archivosUrl: deleteField() }
        : {};

  const payload = { ...payloadBase, ...payloadArchivo };

  await updateDoc(refDocu, payload);

  await actualizarFechaUltimoSeguimiento(clienteId, deudorId, ahora);
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
    if (d.archivosUrl) await Promise.all(d.archivosUrl.map(safeDeleteByUrl));
  }
  await deleteDoc(refDocu);
  await registrarEliminacion({
    modulo: "seguimientoJuridico",
    descripcion: snap.exists() ? (snap.data() as Seguimiento).descripcion : seguimientoId,
    coleccionPath: `clientes/${clienteId}/deudores/${deudorId}/seguimientoJuridico`,
  });
}
