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
import { MensajeValorAgregado } from "../models/mensajeValorAgregado.model";
import { getAuth } from "firebase/auth";


async function obtenerContactoUsuario(usuarioID: string): Promise<{
  nombre?: string;
  correo?: string;
  whatsapp?: string;
}> {
  let nombre: string | undefined;
  let correo: string | undefined;
  let whatsapp: string | undefined;

  const uSnap = await getDoc(doc(db, `usuarios/${usuarioID}`));
  if (uSnap.exists()) {
    const uData: any = uSnap.data() || {};
    nombre = uData.nombre || nombre;
    correo = uData.email || correo;
    whatsapp = normalizeToE164(uData.telefonoUsuario, { defaultCountry: "CO" }) || whatsapp;
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
  console.log(`Creando valor agregado para el cliente ${clienteId}...`);
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

  // 3️⃣ Enviar notificación al ABOGADO del cliente (si aplica)
  try {
    const contacto = await obtenerContactoAbogadoDeCliente(clienteId);
    console.log(`Contacto abogado del cliente ${clienteId}:`, contacto);

    const nombreCliente = clienteId;
    const tipoLabel = TipoValorAgregadoLabels[data.tipo];
    const nombreValor = data.titulo || "Documento";
    const nombreDestinatario = contacto.nombre || "Usuario";
    const descripcionValor = data.descripcion || "";

    if (contacto.correo) {
      await enviarNotificacionValorAgregadoBasico(contacto.correo, {
        nombreCliente,
        nombreDestinatario,
        tipoLabel,
        nombreValor,
        descripcionValor,
      });
    } else {
      console.warn(
        `[crearValorAgregado] Cliente ${clienteId} sin abogado con correo; no se envía notificación.`
      );
    }
  } catch (err) {
    console.error("[crearValorAgregado] Error al enviar notificación:", err);
  }

  return valorId;
}

async function obtenerContactoAbogadoDeCliente(clienteId: string): Promise<{
  nombre?: string;
  correo?: string;
  whatsapp?: string;
}> {
  // 1. Leer el cliente
  const cSnap = await getDoc(doc(db, `clientes/${clienteId}`));
  if (!cSnap.exists()) {
    console.warn(`[obtenerContactoAbogadoDeCliente] Cliente ${clienteId} no existe`);
    return { nombre: undefined, correo: undefined, whatsapp: undefined };
  }

  const cData: any = cSnap.data() || {};
  const abogadoId: string | undefined = cData.abogadoId;

  if (!abogadoId) {
    console.warn(
      `[obtenerContactoAbogadoDeCliente] Cliente ${clienteId} no tiene abogadoId definido`
    );
    return { nombre: undefined, correo: undefined, whatsapp: undefined };
  }

  // 2. Reusar tu helper que lee de usuarios/{usuarioID}
  return await obtenerContactoUsuario(abogadoId);
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


export async function listarConversacionValorAgregado(
  clienteId: string,
  valorId: string
): Promise<MensajeValorAgregado[]> {
  const qy = query(colRefConversacion(clienteId, valorId), orderBy("fecha", "asc"));
  const snap = await getDocs(qy);

  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      descripcion: data.descripcion ?? "",
      fecha: data.fecha,
      archivoPath: data.archivoPath,
      archivoURL: data.archivoURL,
      archivoNombre: data.archivoNombre,
      autorTipo: data.autorTipo === "cliente" ? "cliente" : "abogado",
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
  autorTipo: "cliente" | "abogado";
};

export async function crearMensajeConversacionValorAgregado(
  clienteId: string,
  valorId: string,
  data: CrearMensajeConversacionInput,
  archivo?: File
): Promise<string> {
  const base: any = {
    descripcion: (data.descripcion ?? "").trim(),
    fecha: data.fechaTs ?? serverTimestamp(),
    autorTipo: data.autorTipo === "cliente" ? "cliente" : "abogado",
  };

  if (!base.descripcion && !archivo) {
    throw new Error("Debes escribir una descripción o adjuntar un archivo.");
  }

  const created = await addDoc(colRefConversacion(clienteId, valorId), base);
  const msgId = created.id;

  if (archivo) {
    const path = storagePathConversacion(clienteId, valorId, msgId, archivo.name);
    const rf = ref(storage, path);
    await uploadBytes(rf, archivo);
    const url = await getDownloadURL(rf);

    await updateDoc(docRefConversacion(clienteId, valorId, msgId), {
      archivoPath: path,
      archivoURL: url,
      archivoNombre: archivo.name,
    });
  }

  return msgId;
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
  if (data.archivoPath) {
    try {
      await deleteObject(ref(storage, data.archivoPath));
    } catch {
      /* ignore */
    }
  }
  await deleteDoc(docRefConversacion(clienteId, valorId, msgId));
}
