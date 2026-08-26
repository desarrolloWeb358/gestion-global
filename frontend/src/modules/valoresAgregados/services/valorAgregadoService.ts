import {
  addDoc,
  arrayUnion,
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
  deleteField,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../../../firebase";
import { registrarEliminacion } from "@/shared/services/auditLog/auditLogService";
import { ArchivoAdjunto, EstadoValorAgregado, ValorAgregado } from "../models/valorAgregado.model";
import { TipoValorAgregado } from "../../../shared/constants/tipoValorAgregado";
import { MensajeValorAgregado, type AutorTipoValorAgregado } from "../models/mensajeValorAgregado.model";




// =====================================================
// 🧩 Tipos y mapeos
// =====================================================
function normalizarTipo(input: unknown): TipoValorAgregado {
  const v = String(input ?? "").trim().toLowerCase();
  const map: Record<string, TipoValorAgregado> = {
    "derecho de peticion": TipoValorAgregado.DERECHO_DE_PETICION,
    "tutela": TipoValorAgregado.TUTELA,
    "desacato": TipoValorAgregado.DESACATO,
    "estudios contratos": TipoValorAgregado.ESTUDIOS_CONTRATOS,
  };
  return map[v] ?? TipoValorAgregado.DERECHO_DE_PETICION;
}

const AUTOR_TIPOS = new Set<AutorTipoValorAgregado>([
  "cliente",
  "abogado",
  "dependiente",
  "admin",
  "ejecutivoAdmin",
  "ejecutivo",
  "supervisor",
  "adminFranquicia",
]);

function normalizarAutorTipo(input: unknown): AutorTipoValorAgregado {
  const autorTipo = String(input ?? "") as AutorTipoValorAgregado;
  return AUTOR_TIPOS.has(autorTipo) ? autorTipo : "abogado";
}


function mapDocToValorAgregado(id: string, data: any): ValorAgregado {
  // Si ya tiene el array nuevo lo usa; si no, construye uno desde los campos planos (docs viejos)
  const archivos: ArchivoAdjunto[] =
    data.archivos ??
    (data.archivoURL
      ? [{ nombre: data.archivoNombre ?? "", path: data.archivoPath ?? "", url: data.archivoURL }]
      : []);

  return {
    id,
    tipo: normalizarTipo(data.tipo),
    fecha: data.fecha,
    titulo: data.titulo ?? "",
    descripcion: data.descripcion ?? "",
    clienteId: data.clienteId,
    archivoPath: data.archivoPath,
    archivoURL: data.archivoURL,
    archivoNombre: data.archivoNombre,
    archivos,
    // Fallback a `completado` para documentos aún no migrados.
    estado: normalizarEstado(data.estado, data.completado),
    esperaRespuestaDe: data.esperaRespuestaDe === "cliente" ? "cliente" : "juridica",
    fechaResolucion: data.fechaResolucion ?? data.fechaCompletado ?? null,
    resueltoPor: data.resueltoPor ?? null,
    estadoMigradoRevisar: data.estadoMigradoRevisar === true,
    completado: data.completado ?? false,
    fechaLimite: data.fechaLimite ?? null,
    fechaCompletado: data.fechaCompletado ?? null,
    fechaUltimaActualizacion: data.fechaUltimaActualizacion ?? null,
  };
}

function normalizarEstado(
  estado: unknown,
  completadoLegacy: unknown
): EstadoValorAgregado {
  if (estado === "abierto" || estado === "resuelto") return estado;
  return completadoLegacy === true ? "resuelto" : "abierto";
}

function calcularFechaLimite(tipo: TipoValorAgregado, fechaBase: Date): Date {
  const DIAS_POR_TIPO: Record<TipoValorAgregado, number> = {
    [TipoValorAgregado.DERECHO_DE_PETICION]: 10,
    [TipoValorAgregado.TUTELA]: 1,
    [TipoValorAgregado.DESACATO]: 1,
    [TipoValorAgregado.ESTUDIOS_CONTRATOS]: 3,
  };
  const fecha = new Date(fechaBase);
  fecha.setDate(fecha.getDate() + (DIAS_POR_TIPO[tipo] ?? 3));
  return fecha;
}

// =====================================================
// 🗂️ Helpers de Firestore y Storage
// =====================================================
function colRef(clienteId: string) {
  return collection(db, `clientes/${clienteId}/valoresAgregados`);
}
function docRef(clienteId: string, valorId: string) {
  return doc(db, `clientes/${clienteId}/valoresAgregados/${valorId}`);
}
function storagePath(clienteId: string, valorId: string, fileName: string) {
  return `clientes/${clienteId}/valoresAgregados/${valorId}/${fileName}`;
}

// =====================================================
// 📅 Helpers de fecha
// =====================================================
export function formatFechaCO(
  ts?: Timestamp | { seconds: number; nanoseconds: number }
): string {
  if (!ts) return "";
  const d =
    ts instanceof Timestamp
      ? ts.toDate()
      : new Timestamp(ts.seconds, ts.nanoseconds).toDate();
  return d.toLocaleDateString("es-CO");
}

export function timestampToDateInput(
  ts?: Timestamp | { seconds: number; nanoseconds: number }
): string {
  if (!ts) return "";
  const d =
    ts instanceof Timestamp
      ? ts.toDate()
      : new Timestamp(ts.seconds, ts.nanoseconds).toDate();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// =====================================================
// 📋 CRUD Valor Agregado
// =====================================================
export async function listarValoresAgregados(
  clienteId: string
): Promise<ValorAgregado[]> {
  const q = query(colRef(clienteId), orderBy("fecha", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDocToValorAgregado(d.id, d.data()));
}

export async function obtenerValorAgregado(
  clienteId: string,
  valorId: string
): Promise<ValorAgregado | null> {
  const snap = await getDoc(docRef(clienteId, valorId));
  if (!snap.exists()) return null;
  return mapDocToValorAgregado(snap.id, snap.data());
}

type CrearValorInput = {
  tipo: TipoValorAgregado;
  titulo: string;
  descripcion?: string;
  fechaTs?: Timestamp;
};

type ActualizarValorPatch = Partial<{
  tipo: TipoValorAgregado;
  titulo: string;
  descripcion: string;
  fechaTs: Timestamp;
}>;

export async function crearValorAgregado(
  clienteId: string,
  data: CrearValorInput,
  archivosFiles?: File[]
): Promise<string> {

  console.log(`Creando valor agregado para el cliente ${clienteId}...`);
  const payload: any = {
    tipo: data.tipo,
    titulo: data.titulo,
    descripcion: data.descripcion ?? "",
    fecha: data.fechaTs ?? serverTimestamp(),
    // Denormalizado para que la pantalla global pueda acotar por cliente/abogado.
    clienteId,
    estado: "abierto" as EstadoValorAgregado,
    // Lo radica el cliente, así que el turno arranca en jurídica.
    esperaRespuestaDe: "juridica",
    fechaResolucion: null,
    resueltoPor: null,
    // Se calcula una sola vez: reabrir el trámite no reinicia el plazo legal.
    fechaLimite: Timestamp.fromDate(calcularFechaLimite(data.tipo, data.fechaTs?.toDate() ?? new Date())),
    archivos: [],
    // @deprecated — se sigue escribiendo durante la transición (fase 5 lo elimina).
    completado: false,
  };

  // 1️⃣ Crear doc base
  const created = await addDoc(colRef(clienteId), payload);
  const valorId = created.id;

  // 2️⃣ Subir archivos si vienen
  if (archivosFiles && archivosFiles.length > 0) {
    const archivos = await Promise.all(
      archivosFiles.map(async (archivo) => {
        const path = storagePath(clienteId, valorId, archivo.name);
        const rf = ref(storage, path);
        await uploadBytes(rf, archivo);
        const url = await getDownloadURL(rf);
        return { nombre: archivo.name, path, url } as ArchivoAdjunto;
      })
    );

    const updateData: any = { archivos };
    // Compatibilidad hacia atrás: primer archivo también en campos planos
    updateData.archivoPath = archivos[0].path;
    updateData.archivoURL = archivos[0].url;
    updateData.archivoNombre = archivos[0].nombre;

    await updateDoc(docRef(clienteId, valorId), updateData);
  }

  // La notificación (alerta + correo) al abogado/dependiente la dispara el
  // backend (Cloud Function notificarValorAgregadoCreado) al detectar la
  // creación del documento, para no depender de que el navegador siga
  // abierto hasta completar el envío del correo.

  return valorId;
}



export async function actualizarValorAgregado(
  clienteId: string,
  valorId: string,
  patch: ActualizarValorPatch,
  nuevosArchivos?: File[]
): Promise<void> {

  const basePatch: any = {};
  if (patch.tipo !== undefined) basePatch.tipo = patch.tipo;
  if (patch.titulo !== undefined) basePatch.titulo = patch.titulo;
  if (patch.descripcion !== undefined) basePatch.descripcion = patch.descripcion;
  if (patch.fechaTs !== undefined) basePatch.fecha = patch.fechaTs;

  // 1️⃣ Subir nuevos archivos y agregarlos al array existente
  if (nuevosArchivos && nuevosArchivos.length > 0) {
    const archivosNuevos = await Promise.all(
      nuevosArchivos.map(async (archivo) => {
        const path = storagePath(clienteId, valorId, archivo.name);
        const rf = ref(storage, path);
        await uploadBytes(rf, archivo);
        const url = await getDownloadURL(rf);
        return { nombre: archivo.name, path, url } as ArchivoAdjunto;
      })
    );
    // arrayUnion agrega los nuevos sin borrar los existentes
    basePatch.archivos = arrayUnion(...archivosNuevos);
  }

  // 2️⃣ Actualizar el documento en Firestore
  await updateDoc(docRef(clienteId, valorId), basePatch);

  // La notificación de "valor agregado modificado" la dispara el backend
  // (Cloud Function notificarValorAgregadoActualizado) cuando detecta un
  // cambio real en tipo/titulo/descripcion/fecha, por la misma razón que
  // en crearValorAgregado.
}

export async function eliminarValorAgregado(
  clienteId: string,
  valorId: string
): Promise<void> {
  const actual = await obtenerValorAgregado(clienteId, valorId);

  // Eliminar todos los archivos del array (nuevo) o el campo plano (docs viejos)
  const archivos: ArchivoAdjunto[] =
    actual?.archivos && actual.archivos.length > 0
      ? actual.archivos
      : actual?.archivoPath
        ? [{ nombre: actual.archivoNombre ?? "", path: actual.archivoPath, url: actual.archivoURL ?? "" }]
        : [];

  await Promise.all(archivos.map((a) => deleteObject(ref(storage, a.path)).catch(() => {})));

  await deleteDoc(docRef(clienteId, valorId));
  await registrarEliminacion({
    modulo: "valorAgregado",
    descripcion: `${actual?.tipo ?? "Valor agregado"} - ${actual?.descripcion ?? valorId}`,
    coleccionPath: `clientes/${clienteId}/valoresAgregados`,
  });
}


export async function listarConversacionValorAgregado(
  clienteId: string,
  valorId: string
): Promise<MensajeValorAgregado[]> {
  const qy = query(colRefConversacion(clienteId, valorId), orderBy("fecha", "asc"));
  const snap = await getDocs(qy);

  return snap.docs.map((d) => {
    const data = d.data() as any;
    const archivos: ArchivoAdjunto[] =
      data.archivos ??
      (data.archivoURL
        ? [{ nombre: data.archivoNombre ?? "", path: data.archivoPath ?? "", url: data.archivoURL }]
        : []);
    return {
      id: d.id,
      descripcion: data.descripcion ?? "",
      fecha: data.fecha,
      fechaEdicion: data.fechaEdicion,
      archivoPath: data.archivoPath,
      archivoURL: data.archivoURL,
      archivoNombre: data.archivoNombre,
      archivos,
      autorTipo: normalizarAutorTipo(data.autorTipo),
    } as MensajeValorAgregado;
  });
}



// =====================================================
// 💬 Conversación de Valor Agregado
//    clientes/{clienteId}/valoresAgregados/{valorId}/conversacion
// =====================================================
function colRefConversacion(clienteId: string, valorId: string) {
  return collection(
    db,
    "clientes",
    clienteId,
    "valoresAgregados",
    valorId,
    "conversacion"
  );
}

function docRefConversacion(clienteId: string, valorId: string, msgId: string) {
  return doc(
    db,
    "clientes",
    clienteId,
    "valoresAgregados",
    valorId,
    "conversacion",
    msgId
  );
}

function storagePathConversacion(
  clienteId: string,
  valorId: string,
  msgId: string,
  fileName: string
) {
  return `clientes/${clienteId}/valoresAgregados/${valorId}/conversacion/${msgId}/${fileName}`;
}

// AHORA
export type CrearMensajeConversacionInput = {
  descripcion: string;
  fechaTs?: Timestamp;
  autorTipo: AutorTipoValorAgregado;
};

export async function crearMensajeConversacionValorAgregado(
  clienteId: string,
  valorId: string,
  data: CrearMensajeConversacionInput,
  archivosFiles?: File[]
): Promise<string> {
  const base: any = {
    descripcion: (data.descripcion ?? "").trim(),
    fecha: data.fechaTs ?? serverTimestamp(),
    autorTipo: normalizarAutorTipo(data.autorTipo),
    archivos: [],
  };

  if (!base.descripcion && (!archivosFiles || archivosFiles.length === 0)) {
    throw new Error("Debes escribir una descripción o adjuntar un archivo.");
  }

  // 1️⃣ Crear doc del mensaje
  const created = await addDoc(colRefConversacion(clienteId, valorId), base);
  const msgId = created.id;

  // 2️⃣ Subir archivos si vienen
  if (archivosFiles && archivosFiles.length > 0) {
    const archivos = await Promise.all(
      archivosFiles.map(async (archivo) => {
        const path = storagePathConversacion(clienteId, valorId, msgId, archivo.name);
        const rf = ref(storage, path);
        await uploadBytes(rf, archivo);
        const url = await getDownloadURL(rf);
        return { nombre: archivo.name, path, url } as ArchivoAdjunto;
      })
    );

    const updateData: any = { archivos };
    // Compatibilidad hacia atrás: primer archivo también en campos planos
    updateData.archivoPath = archivos[0].path;
    updateData.archivoURL = archivos[0].url;
    updateData.archivoNombre = archivos[0].nombre;

    await updateDoc(docRefConversacion(clienteId, valorId, msgId), updateData);
  }

  // El resto lo hace la Cloud Function `procesarMensajeValorAgregado`:
  // fija `esperaRespuestaDe`, reabre el trámite si el cliente escribe sobre uno
  // ya resuelto, y reparte alertas y correos. Vive en el backend para que no
  // dependa de que el navegador siga abierto (mismo incidente que movió la
  // creación y la edición a Cloud Functions).

  return msgId;
}

export async function actualizarMensajeConversacionValorAgregado(
  clienteId: string,
  valorId: string,
  msgId: string,
  descripcion: string
): Promise<void> {
  const texto = (descripcion ?? "").trim();
  const snap = await getDoc(docRefConversacion(clienteId, valorId, msgId));

  if (!snap.exists()) {
    throw new Error("El mensaje no existe.");
  }

  const data: any = snap.data() || {};
  const tieneArchivos =
    (Array.isArray(data.archivos) && data.archivos.length > 0) ||
    Boolean(data.archivoURL);

  if (!texto && !tieneArchivos) {
    throw new Error("El mensaje no puede quedar vacío.");
  }

  await updateDoc(docRefConversacion(clienteId, valorId, msgId), {
    descripcion: texto,
    fechaEdicion: serverTimestamp(),
  });

  await updateDoc(docRef(clienteId, valorId), {
    fechaUltimaActualizacion: serverTimestamp(),
  }).catch((err) => {
    console.error("[actualizarMensajeConversacionValorAgregado] Error actualizando padre:", err);
  });
}


// =====================================================
// ✅ Estado del trámite
//    Resolver y reabrir son decisiones explícitas de una persona. El ir y venir
//    de la conversación NO las toca: eso vive en `esperaRespuestaDe`, que escribe
//    la Cloud Function del hilo.
// =====================================================

/** Marca el trámite como resuelto. La notificación al cliente la dispara la
 *  Cloud Function `notificarCambioEstadoValorAgregado` al ver el cambio. */
export async function resolverValorAgregado(
  clienteId: string,
  valorId: string,
  opciones: { resueltoPor: string }
): Promise<void> {
  await updateDoc(docRef(clienteId, valorId), {
    estado: "resuelto" as EstadoValorAgregado,
    // Se sobrescribe a propósito: si el trámite se resolvió, se reabrió y se
    // volvió a resolver, la fecha de entrega válida es la última.
    fechaResolucion: serverTimestamp(),
    resueltoPor: opciones.resueltoPor,
    // Ya lo revisó una persona: deja de ser un caso dudoso de la migración.
    estadoMigradoRevisar: deleteField(),
    // @deprecated — sincronizado mientras `completado` siga existiendo.
    completado: true,
    fechaCompletado: serverTimestamp(),
  });
}

/** Reabre el trámite sin necesidad de que el cliente escriba. `fechaResolucion`
 *  NO se limpia: el reporte mensual la usa como fecha de entrega y el trámite sí
 *  llegó a entregarse alguna vez. */
export async function reabrirValorAgregado(
  clienteId: string,
  valorId: string
): Promise<void> {
  await updateDoc(docRef(clienteId, valorId), {
    estado: "abierto" as EstadoValorAgregado,
    estadoMigradoRevisar: deleteField(),
    // @deprecated
    completado: false,
  });
}

export async function eliminarMensajeConversacionValorAgregado(
  clienteId: string,
  valorId: string,
  msgId: string
): Promise<void> {
  const snap = await getDoc(docRefConversacion(clienteId, valorId, msgId));
  if (!snap.exists()) {
    return;
  }
  const data: any = snap.data() || {};

  // Eliminar todos los archivos del array (nuevo) o el campo plano (docs viejos)
  const archivos: ArchivoAdjunto[] =
    data.archivos && data.archivos.length > 0
      ? data.archivos
      : data.archivoPath
        ? [{ nombre: data.archivoNombre ?? "", path: data.archivoPath, url: data.archivoURL ?? "" }]
        : [];

  await Promise.all(archivos.map((a) => deleteObject(ref(storage, a.path)).catch(() => {})));

  await deleteDoc(docRefConversacion(clienteId, valorId, msgId));
  await registrarEliminacion({
    modulo: "mensajeConversacion",
    descripcion: `Mensaje de conversación en valor agregado ${valorId}`,
    coleccionPath: `clientes/${clienteId}/valoresAgregados/${valorId}/conversacion`,
  });
}
