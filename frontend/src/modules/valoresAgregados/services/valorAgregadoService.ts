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
import { TipoValorAgregado } from "../../../shared/constants/tipoValorAgregado";

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
    creadoEn: data.creadoEn,
    actualizadoEn: data.actualizadoEn,
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
  data: CrearValorInput,
  archivo?: File
): Promise<string> {
  const payload: Partial<ValorAgregado> = {
    tipo: data.tipo,
    titulo: data.titulo,
    observaciones: data.observaciones ?? "",
    fecha: data.fechaTs ?? serverTimestamp(), // ⬅️ guarda como Timestamp
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  };

  const created = await addDoc(colRef(clienteId), payload);
  const valorId = created.id;

  if (archivo) {
    const path = storagePath(clienteId, valorId, archivo.name);
    const rf = ref(storage, path);
    await uploadBytes(rf, archivo);
    const url = await getDownloadURL(rf);

    await updateDoc(docRef(clienteId, valorId), {
      archivoPath: path,
      archivoURL: url,
      archivoNombre: archivo.name,
      actualizadoEn: serverTimestamp(),
    });
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
  const basePatch: any = { actualizadoEn: serverTimestamp() };
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
