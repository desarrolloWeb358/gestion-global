// modules/casos/services/casoService.ts
//
// CRUD de casos + documentos adjuntos.
// Ruta: clientesParticulares/{clienteParticularId}/casos/{casoId}
import { db, storage } from "@/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { registrarEliminacion } from "@/shared/services/auditLog/auditLogService";
import {
  calcularProximaAccion,
  toDateSafe,
} from "@/modules/cobranza/models/demanda.model";
import type {
  Caso,
  ContraparteCaso,
  DocumentoCaso,
  EtiquetaEnCaso,
  ProcesoJudicialCaso,
} from "../models/caso.model";
import { getClienteParticularById } from "./clienteParticularService";

/* ====================== Helpers ====================== */

export function casosPath(clienteParticularId: string) {
  return `clientesParticulares/${clienteParticularId}/casos`;
}

export function casoPath(clienteParticularId: string, casoId: string) {
  return `${casosPath(clienteParticularId)}/${casoId}`;
}

function casosCol(clienteParticularId: string) {
  return collection(db, casosPath(clienteParticularId));
}

function casoDoc(clienteParticularId: string, casoId: string) {
  return doc(db, casoPath(clienteParticularId, casoId));
}

/** Convierte cualquier fecha a Timestamp; `null` se preserva. */
function toTsOrNull(v: any): Timestamp | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const d = toDateSafe(v);
  return d ? Timestamp.fromDate(d) : null;
}

function normalizarContraparte(items: ContraparteCaso[]): ContraparteCaso[] {
  return items
    .filter((c) => (c.nombre ?? "").trim())
    .map((c) => ({
      nombre: c.nombre.trim(),
      numeroDocumento: (c.numeroDocumento ?? "").trim(),
    }));
}

function normalizarEtiquetas(etiquetas: EtiquetaEnCaso[]): EtiquetaEnCaso[] {
  return etiquetas
    .filter((e) => (e.nombre ?? "").trim())
    .map((e) => ({
      ...(e.etiquetaId ? { etiquetaId: e.etiquetaId } : {}),
      nombre: e.nombre.trim(),
      detalle: (e.detalle ?? "").trim(),
      fecha: toTsOrNull(e.fecha) ?? null,
    }));
}

function mapDoc(id: string, data: any): Caso {
  return {
    id,
    tipoCaso: data.tipoCaso ?? "",
    titulo: data.titulo ?? "",
    descripcion: data.descripcion ?? "",
    rolCliente: data.rolCliente ?? "demandante",
    contraparte: Array.isArray(data.contraparte) ? data.contraparte : [],
    numeroRadicado: data.numeroRadicado ?? "",
    juzgado: data.juzgado ?? "",
    localidad: data.localidad ?? "",
    estado: data.estado === "terminado" ? "terminado" : "activo",
    etiquetas: Array.isArray(data.etiquetas) ? data.etiquetas : [],
    proximaAccionFecha: data.proximaAccionFecha ?? null,
    documentos: Array.isArray(data.documentos) ? data.documentos : [],
    procesoJudicial: data.procesoJudicial ?? undefined,
    fechaInicio: data.fechaInicio ?? null,
    fechaUltimaRevision: data.fechaUltimaRevision ?? null,
    fechaCreacion: data.fechaCreacion ?? null,
    fechaActualizacion: data.fechaActualizacion ?? null,
    clienteParticularId: data.clienteParticularId ?? "",
    clienteNombre: data.clienteNombre ?? "",
  };
}

/* ====================== CRUD ====================== */

export async function getCasos(clienteParticularId: string): Promise<Caso[]> {
  const snap = await getDocs(
    query(casosCol(clienteParticularId), orderBy("fechaCreacion", "desc"))
  );
  return snap.docs.map((d) => mapDoc(d.id, d.data()));
}

export async function getCasoById(
  clienteParticularId: string,
  casoId: string
): Promise<Caso | null> {
  const snap = await getDoc(casoDoc(clienteParticularId, casoId));
  return snap.exists() ? mapDoc(snap.id, snap.data()) : null;
}

export type CasoInput = {
  tipoCaso?: string;
  titulo?: string;
  descripcion?: string;
  rolCliente?: Caso["rolCliente"];
  contraparte?: ContraparteCaso[];
  numeroRadicado?: string;
  juzgado?: string;
  localidad?: string;
  estado?: Caso["estado"];
  etiquetas?: EtiquetaEnCaso[];
  fechaInicio?: any;
  fechaUltimaRevision?: any;
  procesoJudicial?: ProcesoJudicialCaso;
};

export async function crearCaso(
  clienteParticularId: string,
  data: CasoInput
): Promise<string> {
  const cliente = await getClienteParticularById(clienteParticularId);
  const contraparte = normalizarContraparte(data.contraparte ?? []);
  const etiquetas = normalizarEtiquetas(data.etiquetas ?? []);
  const proxima = calcularProximaAccion(etiquetas);

  const payload = {
    tipoCaso: data.tipoCaso?.trim() ?? "",
    titulo: data.titulo?.trim() ?? "",
    descripcion: data.descripcion?.trim() ?? "",
    rolCliente: data.rolCliente ?? "demandante",
    contraparte,
    numeroRadicado: data.numeroRadicado?.trim() ?? "",
    juzgado: data.juzgado?.trim() ?? "",
    localidad: data.localidad?.trim() ?? "",
    estado: data.estado ?? "activo",
    etiquetas,
    proximaAccionFecha: proxima ? Timestamp.fromDate(proxima) : null,
    documentos: [] as DocumentoCaso[],
    fechaInicio: toTsOrNull(data.fechaInicio) ?? null,
    fechaUltimaRevision: toTsOrNull(data.fechaUltimaRevision) ?? null,
    ...(data.procesoJudicial ? { procesoJudicial: data.procesoJudicial } : {}),
    fechaCreacion: serverTimestamp(),
    fechaActualizacion: serverTimestamp(),
    // Denormalizados para collectionGroup("casos")
    clienteParticularId,
    clienteNombre: cliente?.nombre ?? "",
  };

  const created = await addDoc(casosCol(clienteParticularId), payload);
  return created.id;
}

export async function actualizarCaso(
  clienteParticularId: string,
  casoId: string,
  data: CasoInput
): Promise<void> {
  const next: Record<string, any> = { fechaActualizacion: serverTimestamp() };

  if (data.tipoCaso !== undefined) next.tipoCaso = data.tipoCaso.trim();
  if (data.titulo !== undefined) next.titulo = data.titulo.trim();
  if (data.descripcion !== undefined) next.descripcion = data.descripcion;
  if (data.rolCliente !== undefined) next.rolCliente = data.rolCliente;
  if (data.numeroRadicado !== undefined) next.numeroRadicado = data.numeroRadicado.trim();
  if (data.juzgado !== undefined) next.juzgado = data.juzgado.trim();
  if (data.localidad !== undefined) next.localidad = data.localidad.trim();
  if (data.estado !== undefined) next.estado = data.estado;
  if (data.fechaInicio !== undefined) next.fechaInicio = toTsOrNull(data.fechaInicio);
  if (data.fechaUltimaRevision !== undefined)
    next.fechaUltimaRevision = toTsOrNull(data.fechaUltimaRevision);
  if (data.procesoJudicial !== undefined) next.procesoJudicial = data.procesoJudicial;
  if (data.contraparte !== undefined)
    next.contraparte = normalizarContraparte(data.contraparte);

  if (data.etiquetas !== undefined) {
    const etiquetas = normalizarEtiquetas(data.etiquetas);
    next.etiquetas = etiquetas;
    const proxima = calcularProximaAccion(etiquetas);
    next.proximaAccionFecha = proxima ? Timestamp.fromDate(proxima) : null;
  }

  await updateDoc(casoDoc(clienteParticularId, casoId), next);
}

export async function actualizarEstadoCaso(
  clienteParticularId: string,
  casoId: string,
  estado: Caso["estado"]
): Promise<void> {
  await updateDoc(casoDoc(clienteParticularId, casoId), {
    estado,
    fechaActualizacion: serverTimestamp(),
  });
}

export async function actualizarProcesoJudicialCaso(
  clienteParticularId: string,
  casoId: string,
  procesoJudicial: ProcesoJudicialCaso
): Promise<void> {
  await updateDoc(casoDoc(clienteParticularId, casoId), { procesoJudicial });
}

/** Borra el caso, su seguimiento, sus observaciones y sus documentos. */
export async function eliminarCaso(
  clienteParticularId: string,
  casoId: string
): Promise<void> {
  const refDoc = casoDoc(clienteParticularId, casoId);
  const snap = await getDoc(refDoc);
  const data = snap.exists() ? mapDoc(snap.id, snap.data()) : null;

  for (const sub of ["seguimiento", "observaciones"]) {
    const subSnap = await getDocs(collection(db, `${refDoc.path}/${sub}`));
    if (!subSnap.empty) {
      const batch = writeBatch(db);
      subSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  for (const documento of data?.documentos ?? []) {
    await safeDeleteByPath(documento.path);
  }

  await deleteDoc(refDoc);
  await registrarEliminacion({
    modulo: "caso",
    descripcion: data?.titulo || data?.numeroRadicado || casoId,
    coleccionPath: casosPath(clienteParticularId),
  });
}

/* ====================== Documentos ====================== */

async function safeDeleteByPath(path?: string) {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (e) {
    console.warn("No se pudo borrar el archivo de Storage:", e);
  }
}

function nuevoDocumentoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Sube un documento del caso y lo agrega al array `documentos`.
 * Lo usan tanto el equipo como el cliente (desde /mis-casos).
 */
export async function agregarDocumentoCaso(
  clienteParticularId: string,
  casoId: string,
  archivo: File,
  autor: { uid: string; nombre?: string; rol: "cliente" | "equipo" }
): Promise<DocumentoCaso> {
  const path = `clientesParticulares/${clienteParticularId}/casos/${casoId}/documentos/${Date.now()}_${archivo.name}`;
  const sref = ref(storage, path);
  await uploadBytes(sref, archivo);
  const url = await getDownloadURL(sref);

  const documento: DocumentoCaso = {
    id: nuevoDocumentoId(),
    nombre: archivo.name,
    url,
    path,
    mime: archivo.type || "",
    size: archivo.size,
    subidoPor: autor.uid,
    subidoPorNombre: autor.nombre ?? "",
    subidoPorRol: autor.rol,
    subidoEn: Timestamp.now(),
  };

  const actual = await getCasoById(clienteParticularId, casoId);
  const documentos = [...(actual?.documentos ?? []), documento];

  await updateDoc(casoDoc(clienteParticularId, casoId), {
    documentos,
    fechaActualizacion: serverTimestamp(),
  });

  return documento;
}

export async function eliminarDocumentoCaso(
  clienteParticularId: string,
  casoId: string,
  documentoId: string
): Promise<void> {
  const actual = await getCasoById(clienteParticularId, casoId);
  const objetivo = (actual?.documentos ?? []).find((d) => d.id === documentoId);
  if (!objetivo) return;

  await safeDeleteByPath(objetivo.path);

  await updateDoc(casoDoc(clienteParticularId, casoId), {
    documentos: (actual?.documentos ?? []).filter((d) => d.id !== documentoId),
    fechaActualizacion: serverTimestamp(),
  });

  await registrarEliminacion({
    modulo: "documentoCaso",
    descripcion: objetivo.nombre,
    coleccionPath: casoPath(clienteParticularId, casoId),
  });
}
