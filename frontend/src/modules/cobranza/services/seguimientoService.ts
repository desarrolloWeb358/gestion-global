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
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Seguimiento } from "../models/seguimiento.model";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";

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

export type DestinoSeguimiento = "seguimiento" | "seguimientoJuridico";

// Escribe el documento del seguimiento con archivos YA subidos.
// Lo comparten la creación individual y la masiva.
async function escribirSeguimiento(
  destino: DestinoSeguimiento,
  ejecutivoUID: string,
  clienteId: string,
  deudorId: string,
  data: Omit<Seguimiento, "id">,
  archivosUrl?: string[]
) {
  const refCol = collection(db, `clientes/${clienteId}/deudores/${deudorId}/${destino}`);

  const fechaBase = data.fecha instanceof Date ? data.fecha : data.fecha?.toDate?.() ?? new Date();
  const ahora = Timestamp.fromDate(new Date());

  const payload = stripUndefined({
    fecha: Timestamp.fromDate(fechaBase),
    clienteUID: clienteId,
    ejecutivoUID: ejecutivoUID,
    tipoSeguimiento: data.tipoSeguimiento,
    descripcion: data.descripcion,
    actualizadoEn: ahora,
    ...(archivosUrl && archivosUrl.length > 0 ? { archivosUrl } : {}),
  });

  const docRef = await addDoc(refCol, payload);
  await actualizarFechaUltimoSeguimiento(clienteId, deudorId, ahora);
  return docRef;
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

  return escribirSeguimiento("seguimiento", ejecutivoUID, clienteId, deudorId, data, archivosUrl);
}

export async function updateSeguimiento(
  clienteId: string,
  deudorId: string,
  seguimientoId: string,
  data: Omit<Seguimiento, "id">,
  archivos?: File[]
) {
  const refDocu = doc(db, `clientes/${clienteId}/deudores/${deudorId}/seguimiento/${seguimientoId}`);

  const ahora = Timestamp.fromDate(new Date());

  const payloadBase = stripUndefined({
    fecha: data.fecha,
    tipoSeguimiento: data.tipoSeguimiento,
    descripcion: data.descripcion,
    actualizadoEn: ahora,
  });

  let payloadArchivo = {};
  if (archivos && archivos.length > 0) {
    const nuevasUrls = await uploadArchivos(clienteId, deudorId, archivos);
    const existentes = data.archivosUrl ?? [];
    payloadArchivo = { archivosUrl: [...existentes, ...nuevasUrls] };
  }

  await updateDoc(refDocu, { ...payloadBase, ...payloadArchivo });

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
   SEGUIMIENTO INICIAL AUTOMÁTICO
   Se registra al crear un deudor (manual o importación masiva)
   ====================================================== */

function descripcionSeguimientoInicial(fecha: Date): string {
  const fechaTexto = format(fecha, "d 'de' MMMM 'del' yyyy", { locale: es });
  return `El día ${fechaTexto}, la administración nos hace entrega del inmueble para dar inicio a la gestión de cobranza.`;
}

// Crea el primer seguimiento prejurídico de un deudor recién creado.
// No lanza: el deudor ya quedó guardado y un fallo aquí no debe romper
// la creación individual ni abortar la carga masiva.
export async function addSeguimientoInicialDeudor(
  ejecutivoUID: string,
  clienteId: string,
  deudorId: string,
  fecha: Date = new Date()
): Promise<boolean> {
  try {
    await addSeguimiento(ejecutivoUID, clienteId, deudorId, {
      fecha,
      tipoSeguimiento: "otro",
      descripcion: descripcionSeguimientoInicial(fecha),
    });
    return true;
  } catch (e) {
    console.warn("No se pudo crear el seguimiento inicial del deudor:", e);
    return false;
  }
}

/* ======================================================
   CAMBIO DE TIPIFICACIÓN
   Se registra al guardar el historial de tipificaciones del deudor
   ====================================================== */

/**
 * Tipificaciones de etapa jurídica. Su gestión vive en `seguimientoJuridico`,
 * no en `seguimiento`; mismo criterio que `functions/src/shared/tipificaciones.ts`.
 */
const TIPS_JURIDICO = new Set<string>([
  TipificacionDeuda.DEMANDA,
  TipificacionDeuda.DEMANDA_ACUERDO,
  TipificacionDeuda.DEMANDA_TERMINADO,
  TipificacionDeuda.DEMANDA_INSOLVENCIA,
]);

function descripcionCambioTipificacion(
  anterior: string | undefined,
  nueva: string,
  fecha: Date
): string {
  const fechaTexto = format(fecha, "d 'de' MMMM 'del' yyyy", { locale: es });
  if (!anterior) {
    return `El día ${fechaTexto} se registró la tipificación "${nueva}" del deudor.`;
  }
  return `El día ${fechaTexto} se cambió la tipificación del deudor de "${anterior}" a "${nueva}".`;
}

/**
 * Deja constancia del cambio de tipificación como una gestión más del deudor.
 *
 * Queda en la colección de la tipificación NUEVA: el cambio abre la etapa a la
 * que pasa el deudor, así que al pasar de prejurídico a demanda el registro
 * encabeza la pestaña en la que de ahí en adelante se le hace seguimiento.
 *
 * No lanza: la tipificación ya quedó guardada y un fallo aquí no debe hacer
 * ver el cambio como fallido. Igual que `addSeguimientoInicialDeudor`, devuelve
 * si alcanzó a registrarse para que la pantalla avise.
 */
export async function addSeguimientoCambioTipificacion(
  ejecutivoUID: string,
  clienteId: string,
  deudorId: string,
  tipificacionAnterior: string | undefined,
  tipificacionNueva: string,
  fecha: Date = new Date()
): Promise<boolean> {
  const agregar = TIPS_JURIDICO.has(tipificacionNueva) ? addSeguimientoJuridico : addSeguimiento;
  try {
    await agregar(ejecutivoUID, clienteId, deudorId, {
      fecha,
      tipoSeguimiento: "otro",
      descripcion: descripcionCambioTipificacion(tipificacionAnterior, tipificacionNueva, fecha),
    });
    return true;
  } catch (e) {
    console.warn("No se pudo registrar el seguimiento del cambio de tipificación:", e);
    return false;
  }
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

  return escribirSeguimiento("seguimientoJuridico", ejecutivoUID, clienteId, deudorId, data, archivosUrl);
}

export async function updateSeguimientoJuridico(
  clienteId: string,
  deudorId: string,
  seguimientoId: string,
  data: Omit<Seguimiento, "id">,
  archivos?: File[]
) {
  const refDocu = doc(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/seguimientoJuridico/${seguimientoId}`
  );

  const ahora = Timestamp.fromDate(new Date());

  const payloadBase = stripUndefined({
    fecha: data.fecha,
    tipoSeguimiento: data.tipoSeguimiento,
    descripcion: data.descripcion,
    actualizadoEn: ahora,
  });

  let payloadArchivo = {};
  if (archivos && archivos.length > 0) {
    const nuevasUrls = await uploadArchivos(clienteId, deudorId, archivos);
    const existentes = data.archivosUrl ?? [];
    payloadArchivo = { archivosUrl: [...existentes, ...nuevasUrls] };
  }

  await updateDoc(refDocu, { ...payloadBase, ...payloadArchivo });

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

/* ======================================================
   SEGUIMIENTO MASIVO
   Un mismo seguimiento replicado en varios deudores del conjunto
   ====================================================== */

export interface SeguimientoMasivoInput {
  clienteId: string;
  ejecutivoUID: string;
  deudorIds: string[];
  destino: DestinoSeguimiento;
  data: Omit<Seguimiento, "id">;
  archivos?: File[];
  // Se llama después de cada deudor procesado, para la barra de progreso.
  onProgress?: (procesados: number, total: number) => void;
}

export interface ResultadoSeguimientoMasivo {
  exitosos: number;
  fallidos: { deudorId: string; message: string }[];
}

// Cuántos deudores se escriben en paralelo. Suficiente para que 300 deudores
// no tarden una eternidad, sin saturar la cuota de escritura de Firestore.
const LOTE_MASIVO = 10;

// Sube los adjuntos UNA sola vez a una carpeta del cliente y reusa esas URLs
// en todos los deudores, en vez de subir el mismo archivo N veces.
async function uploadArchivosMasivos(clienteId: string, archivos: File[]): Promise<string[]> {
  const carpeta = `clientes/${clienteId}/seguimientosMasivos/${Date.now()}`;
  return Promise.all(
    archivos.map(async (archivo) => {
      const sref = ref(storage, `${carpeta}/${archivo.name}`);
      await uploadBytes(sref, archivo);
      return getDownloadURL(sref);
    })
  );
}

export async function addSeguimientoMasivo({
  clienteId,
  ejecutivoUID,
  deudorIds,
  destino,
  data,
  archivos,
  onProgress,
}: SeguimientoMasivoInput): Promise<ResultadoSeguimientoMasivo> {
  const archivosUrl =
    archivos && archivos.length > 0 ? await uploadArchivosMasivos(clienteId, archivos) : undefined;

  const fallidos: { deudorId: string; message: string }[] = [];
  let exitosos = 0;
  let procesados = 0;

  for (let i = 0; i < deudorIds.length; i += LOTE_MASIVO) {
    const lote = deudorIds.slice(i, i + LOTE_MASIVO);
    await Promise.all(
      lote.map(async (deudorId) => {
        try {
          await escribirSeguimiento(destino, ejecutivoUID, clienteId, deudorId, data, archivosUrl);
          exitosos++;
        } catch (e: any) {
          fallidos.push({ deudorId, message: e?.message ?? "Error desconocido" });
        } finally {
          procesados++;
          onProgress?.(procesados, deudorIds.length);
        }
      })
    );
  }

  return { exitosos, fallidos };
}
