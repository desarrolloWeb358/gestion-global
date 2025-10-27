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
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../../../firebase";
import { ValorAgregado } from "../models/valorAgregado.model";
import { TipoValorAgregado, TipoValorAgregadoLabels } from "../../../shared/constants/tipoValorAgregado";
import { normalizeToE164 } from "@/shared/phoneUtils";
import { enviarNotificacionValorAgregadoBasico } from "./notificacionValorAgregadoService";
import { ObservacionCliente } from "@/modules/cobranza/models/observacionCliente.model";



async function obtenerContactoCliente(clienteId: string): Promise<{
  nombre?: string;
  correo?: string;
  whatsapp?: string;
}> {
  let nombre: string | undefined;
  let correo: string | undefined;
  let whatsapp: string | undefined;

  const uSnap = await getDoc(doc(db, `usuariosSistema/${clienteId}`));
  if (uSnap.exists()) {
    const uData: any = uSnap.data() || {};
    nombre = uData.nombre || nombre;
    correo = uData.email || correo;
    whatsapp = normalizeToE164(uData.telefonoUsuario, { defaultCountry: "CO" }) || whatsapp;
  } else {
    // 2️⃣ Fallback: clientes/{clienteId}
    const cSnap = await getDoc(doc(db, `clientes/${clienteId}`));
    if (cSnap.exists()) {
      const cData: any = cSnap.data() || {};
      nombre = (cData.nombre || cData.razonSocial || nombre)?.toString();
      correo = cData.correo || cData.email || correo;
      whatsapp = normalizeToE164(cData.telefono, { defaultCountry: "CO" }) || whatsapp;
    }
  }

  return { nombre, correo, whatsapp };
}

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

function mapDocToValorAgregado(id: string, data: any): ValorAgregado {
  return {
    id,
    tipo: normalizarTipo(data.tipo),
    fecha: data.fecha,
    titulo: data.titulo ?? "",
    descripcion: data.descripcion ?? "",
    archivoPath: data.archivoPath,
    archivoURL: data.archivoURL,
    archivoNombre: data.archivoNombre,
  };
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
  archivo?: File
): Promise<string> {
  const payload: Partial<ValorAgregado> = {
    tipo: data.tipo,
    titulo: data.titulo,
    descripcion: data.descripcion ?? "",
    fecha: data.fechaTs ?? serverTimestamp(),
  };

  // 1️⃣ Crear doc base
  const created = await addDoc(colRef(clienteId), payload);
  const valorId = created.id;

  // 2️⃣ Subir archivo si viene
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

  // 3️⃣ Enviar notificación (si aplica)
  try {
    const contacto = await obtenerContactoCliente(clienteId);
    const tipoLabel = TipoValorAgregadoLabels[data.tipo];
    const nombreValor = data.titulo || "Documento";
    const nombreCliente = contacto.nombre || "Cliente";

    if (contacto.correo || contacto.whatsapp) {
      await enviarNotificacionValorAgregadoBasico(
        {
          correoCliente: contacto.correo,
          whatsappCliente: contacto.whatsapp,
        },
        {
          nombreCliente,
          tipoLabel,
          nombreValor,
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

export async function actualizarValorAgregado(
  clienteId: string,
  valorId: string,
  patch: ActualizarValorPatch,
  nuevoArchivo?: File
): Promise<void> {
  const basePatch: any = {};
  if (patch.tipo !== undefined) basePatch.tipo = patch.tipo;
  if (patch.titulo !== undefined) basePatch.titulo = patch.titulo;
  if (patch.descripcion !== undefined) basePatch.descripcion = patch.descripcion;
  if (patch.fechaTs !== undefined) basePatch.fecha = patch.fechaTs;

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

// =====================================================
// 💬 Observaciones Cliente
// =====================================================
export async function listarObservacionesCliente(
  clienteId: string,
  valorId: string
): Promise<ObservacionCliente[]> {
  const refCol = collection(
    db,
    "clientes",
    clienteId,
    "valoresAgregados",
    valorId,
    "observacionesCliente"
  );
  const qy = query(refCol, orderBy("fecha", "desc"));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      texto: data.texto ?? "",
      fecha: data.fecha?.toDate?.() ?? new Date(),
    } as ObservacionCliente;
  });
}

export async function crearObservacionCliente(
  clienteId: string,
  valorId: string,
  payload: { texto: string }
): Promise<ObservacionCliente> {
  const refCol = collection(
    db,
    "clientes",
    clienteId,
    "valoresAgregados",
    valorId,
    "observacionesCliente"
  );

  const texto = (payload.texto ?? "").trim();
  if (!texto) throw new Error("El texto de la observación es obligatorio.");

  const fecha = Timestamp.fromDate(new Date());

  // 🕒 Guardar solo texto y fecha
  const created = await addDoc(refCol, {
    texto,
    fecha: new Date(),
  });

  return {
    id: created.id,
    texto,
    fecha,
  } as ObservacionCliente;
}
