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
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../../../firebase";
import { ValorAgregado } from "../models/valorAgregado.model";
import { TipoValorAgregado, TipoValorAgregadoLabels } from "../../../shared/constants/tipoValorAgregado";
import { enviarNotificacionValorAgregadoBasico } from "./NotificacionValorAgregadoService"; 
import { normalizeToE164 } from "@/shared/phoneUtils";



/*
// 👇 Helper para formatear el teléfono del cliente a E.164 Colombia (+57)
function toE164Co(input?: string): string | undefined {
  if (!input) return undefined;
  const digits = input.replace(/\D/g, "");
  if (!digits) return undefined;
  if (input.startsWith("+")) return input;
  if (digits.startsWith("57")) return "+" + digits;
  return "+57" + digits;
}
  */

async function obtenerContactoCliente(clienteId: string): Promise<{
  nombre?: string;
  correo?: string;
  whatsapp?: string;
}> {
  // 1) usuarios/{clienteId}
  const uSnap = await getDoc(doc(db, `usuarios/${clienteId}`));
  let nombre: string | undefined;
  let correo: string | undefined;
  let whatsapp: string | undefined;

  if (uSnap.exists()) {
    const uData: any = uSnap.data() || {};
    nombre = uData.nombre || nombre;
    correo = uData.email || correo;
    //whatsapp = toE164Co(uData.telefonoUsuario) || whatsapp;
    whatsapp = normalizeToE164(uData.telefonoUsuario, { defaultCountry: "CO" }) || whatsapp;
  }

  return { nombre, correo, whatsapp };
}


/** Normaliza el campo 'tipo' a uno de los valores del enum */
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

/** Mapea un doc de Firestore al modelo */
function mapDocToValorAgregado(id: string, data: any): ValorAgregado {
  return {
    id,
    tipo: normalizarTipo(data.tipo),
    fecha: data.fecha,
    titulo: data.titulo ?? "",
    observaciones: data.observaciones ?? "",
    archivoPath: data.archivoPath,
    archivoURL: data.archivoURL,
    archivoNombre: data.archivoNombre,
  };
}

/** Helpers de ruta */
function colRef(clienteId: string) {
  return collection(db, `clientes/${clienteId}/valoresAgregados`);
}
function docRef(clienteId: string, valorId: string) {
  return doc(db, `clientes/${clienteId}/valoresAgregados/${valorId}`);
}
function storagePath(clienteId: string, valorId: string, fileName: string) {
  return `clientes/${clienteId}/valoresAgregados/${valorId}/${fileName}`;
}

/** Formateo de fecha para UI */
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

/** Convierte Timestamp a YYYY-MM-DD (por si lo necesitas en otros componentes) */
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

/** Listado (ordenado por fecha desc) */
export async function listarValoresAgregados(
  clienteId: string
): Promise<ValorAgregado[]> {
  const q = query(colRef(clienteId), orderBy("fecha", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDocToValorAgregado(d.id, d.data()));
}

/** Obtener uno */
export async function obtenerValorAgregado(
  clienteId: string,
  valorId: string
): Promise<ValorAgregado | null> {
  const snap = await getDoc(docRef(clienteId, valorId));
  if (!snap.exists()) return null;
  return mapDocToValorAgregado(snap.id, snap.data());
}

/** Tipos para crear/actualizar con Timestamp directo */
type CrearValorInput = {
  tipo: TipoValorAgregado;
  titulo: string;
  observaciones?: string;
  /** Fecha como Timestamp para guardar directamente en Firestore */
  fechaTs?: Timestamp;
};

type ActualizarValorPatch = Partial<{
  tipo: TipoValorAgregado;
  titulo: string;
  observaciones: string;
  /** Fecha como Timestamp para guardar directamente */
  fechaTs: Timestamp;
}>;

/** Crear (con subida opcional de archivo a Storage) */
export async function crearValorAgregado(
  clienteId: string,
  data: {
    tipo: TipoValorAgregado;
    titulo: string;
    observaciones?: string;
    fechaTs?: Timestamp;
  },
  archivo?: File
): Promise<string> {
  const payload: Partial<ValorAgregado> = {
    tipo: data.tipo,
    titulo: data.titulo,
    observaciones: data.observaciones ?? "",
    fecha: data.fechaTs ?? serverTimestamp(), // ⬅️ Timestamp
  };

  // 1) Guardar doc base
  const created = await addDoc(colRef(clienteId), payload);
  const valorId = created.id;

  // 2) Subir archivo si viene
  if (archivo) {
    const path = storagePath(clienteId, valorId, archivo.name);
    const rf = ref(storage, path);
    await uploadBytes(rf, archivo);
    const url = await getDownloadURL(rf);

    await updateDoc(docRef(clienteId, valorId), {
      archivoPath: path,
      archivoURL: url,
      archivoNombre: archivo.name,
    });
  }

  try {
  const contacto = await obtenerContactoCliente(clienteId); // ← ahora trae de `usuarios/{clienteId}`
  const tipoLabel   = TipoValorAgregadoLabels[data.tipo];
  const nombreValor = data.titulo || "Documento";
  const nombreCliente = contacto.nombre || "Cliente";

  if (contacto.correo || contacto.whatsapp) {
    await enviarNotificacionValorAgregadoBasico(
      {
        correoCliente:  contacto.correo,
        whatsappCliente: contacto.whatsapp,
      },
      {
        nombreCliente,   // {{1}}
        tipoLabel,       // {{2}}
        nombreValor,     // {{3}}
      }
    );
  } else {
    console.warn(`[crearValorAgregado] Cliente ${clienteId} sin correo/whatsapp; no se envía notificación.`);
  }
} catch (err) {
  console.error("[crearValorAgregado] Error al enviar notificación:", err);
}

  return valorId;
}

/** Actualizar (con reemplazo opcional de archivo) */
export async function actualizarValorAgregado(
  clienteId: string,
  valorId: string,
  patch: ActualizarValorPatch,
  nuevoArchivo?: File
): Promise<void> {
  const basePatch: any = { };
  if (patch.tipo !== undefined) basePatch.tipo = patch.tipo;
  if (patch.titulo !== undefined) basePatch.titulo = patch.titulo;
  if (patch.observaciones !== undefined) basePatch.observaciones = patch.observaciones;
  if (patch.fechaTs !== undefined) basePatch.fecha = patch.fechaTs; // ⬅️ Timestamp

  // Reemplazo de archivo (si viene)
  if (nuevoArchivo) {
    const prev = await obtenerValorAgregado(clienteId, valorId);
    if (prev?.archivoPath) {
      try {
        await deleteObject(ref(storage, prev.archivoPath));
      } catch {
        /* ignore */
      }
    }
    const path = storagePath(clienteId, valorId, nuevoArchivo.name);
    const rf = ref(storage, path);
    await uploadBytes(rf, nuevoArchivo);
    const url = await getDownloadURL(rf);

    basePatch.archivoPath = path;
    basePatch.archivoURL = url;
    basePatch.archivoNombre = nuevoArchivo.name;
  }

  await updateDoc(docRef(clienteId, valorId), basePatch);
}

/** Eliminar (borra también el archivo si existe) */
export async function eliminarValorAgregado(
  clienteId: string,
  valorId: string
): Promise<void> {
  const actual = await obtenerValorAgregado(clienteId, valorId);
  if (actual?.archivoPath) {
    try {
      await deleteObject(ref(storage, actual.archivoPath));
    } catch {
      /* ignore */
    }
  }
  await deleteDoc(docRef(clienteId, valorId));
}
