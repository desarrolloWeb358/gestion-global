// modules/casos/services/seguimientoCasoService.ts
//
// Seguimiento del caso: clientesParticulares/{clienteId}/casos/{casoId}/seguimiento/{id}
//
// Aquí no hay seguimiento interno: cada registro es visible para el cliente,
// por eso al crearlo se le envía alerta en la campanita + correo.
import { db, storage } from "@/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
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
import { registrarEliminacion } from "@/shared/services/auditLog/auditLogService";
import { notificarUsuarioConAlertaYCorreo } from "@/modules/notificaciones/services/notificacionService";
import { toDateSafe } from "@/modules/cobranza/models/demanda.model";
import type { SeguimientoCaso } from "../models/seguimientoCaso.model";
import { casoPath, getCasoById } from "./casoService";

function seguimientoPath(clienteParticularId: string, casoId: string) {
  return `${casoPath(clienteParticularId, casoId)}/seguimiento`;
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

async function uploadArchivo(
  clienteParticularId: string,
  casoId: string,
  archivo: File
): Promise<{ path: string; url: string }> {
  const path = `clientesParticulares/${clienteParticularId}/casos/${casoId}/seguimiento/${Date.now()}_${archivo.name}`;
  const sref = ref(storage, path);
  await uploadBytes(sref, archivo);
  const url = await getDownloadURL(sref);
  return { path, url };
}

async function safeDeleteByPath(path?: string) {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (e) {
    console.warn("No se pudo borrar el archivo de Storage:", e);
  }
}

const fmtFecha = new Intl.DateTimeFormat("es-CO", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** Alerta + correo al cliente cuando su caso registra un avance. */
async function avisarAlCliente(
  clienteParticularId: string,
  casoId: string,
  descripcion: string,
  fecha: Date
): Promise<void> {
  const caso = await getCasoById(clienteParticularId, casoId);
  const referencia =
    caso?.titulo || caso?.numeroRadicado || caso?.tipoCaso || "tu caso";

  await notificarUsuarioConAlertaYCorreo({
    // El id del cliente particular ES el uid del usuario
    usuarioId: clienteParticularId,
    modulo: "caso",
    ruta: `/mis-casos/${casoId}`,
    descripcionAlerta: `Nuevo avance en ${referencia}`,
    nombreDestino: caso?.clienteNombre || "Cliente",
    // "" → el servicio resuelve el correo desde usuarios/{uid}
    correoDestino: "",
    subject: `Avance en tu caso — ${referencia}`,
    tituloCorreo: "Tu caso registra un nuevo avance",
    cuerpoHtmlCorreo: `
      <p>Registramos una nueva actuación en <strong>${referencia}</strong>.</p>
      <table cellpadding="0" cellspacing="0" style="margin:12px 0;background:#f9fafb;padding:12px;border-radius:6px;width:100%;font-size:14px;color:#374151;">
        <tr><td style="padding:4px 0;"><strong>Fecha:</strong></td><td style="padding:4px 0;">${fmtFecha.format(fecha)}</td></tr>
        <tr><td style="padding:4px 0;vertical-align:top;"><strong>Detalle:</strong></td><td style="padding:4px 0;">${descripcion}</td></tr>
      </table>
      <p>Puedes consultar el detalle completo y los documentos del caso ingresando a la plataforma.</p>
    `,
  });
}

/* ====================== CRUD ====================== */

export async function getSeguimientosCaso(
  clienteParticularId: string,
  casoId: string
): Promise<SeguimientoCaso[]> {
  const snap = await getDocs(
    query(collection(db, seguimientoPath(clienteParticularId, casoId)), orderBy("fecha", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as SeguimientoCaso) }));
}

export async function addSeguimientoCaso(
  clienteParticularId: string,
  casoId: string,
  data: Omit<SeguimientoCaso, "id">,
  autor: { uid: string; nombre?: string },
  archivo?: File
): Promise<string> {
  let archivoPath: string | undefined;
  let archivoUrl: string | undefined;

  if (archivo) {
    const up = await uploadArchivo(clienteParticularId, casoId, archivo);
    archivoPath = up.path;
    archivoUrl = up.url;
  }

  const ahora = Timestamp.fromDate(new Date());
  const fechaDate = toDateSafe(data.fecha) ?? new Date();
  const fecha = Timestamp.fromDate(fechaDate);

  const payload = stripUndefined({
    fecha,
    descripcion: data.descripcion,
    tipoSeguimiento: data.tipoSeguimiento,
    creadoPor: autor.uid,
    creadoPorNombre: autor.nombre ?? "",
    actualizadoEn: ahora,
    ...(archivoPath ? { archivoPath } : {}),
    ...(archivoUrl ? { archivoUrl } : {}),
    ...(archivo ? { archivoNombre: archivo.name } : {}),
  });

  const created = await addDoc(
    collection(db, seguimientoPath(clienteParticularId, casoId)),
    payload
  );

  // La última revisión del caso queda con la fecha real del registro
  await updateDoc(doc(db, casoPath(clienteParticularId, casoId)), {
    fechaUltimaRevision: ahora,
    fechaActualizacion: serverTimestamp(),
  });

  try {
    await avisarAlCliente(clienteParticularId, casoId, data.descripcion, fechaDate);
  } catch (err) {
    console.error("[addSeguimientoCaso] No se pudo notificar al cliente:", err);
  }

  return created.id;
}

export async function updateSeguimientoCaso(
  clienteParticularId: string,
  casoId: string,
  seguimientoId: string,
  data: Omit<SeguimientoCaso, "id">,
  archivo?: File,
  reemplazarArchivo?: boolean
): Promise<void> {
  const refDoc = doc(
    db,
    `${seguimientoPath(clienteParticularId, casoId)}/${seguimientoId}`
  );

  let nuevoPath: string | undefined;
  let nuevaUrl: string | undefined;

  if (archivo) {
    if (data.archivoPath && reemplazarArchivo) {
      await safeDeleteByPath(data.archivoPath);
    }
    const up = await uploadArchivo(clienteParticularId, casoId, archivo);
    nuevoPath = up.path;
    nuevaUrl = up.url;
  }

  const fechaDate = toDateSafe(data.fecha);

  const base = stripUndefined({
    fecha: fechaDate ? Timestamp.fromDate(fechaDate) : undefined,
    descripcion: data.descripcion,
    tipoSeguimiento: data.tipoSeguimiento,
    actualizadoEn: Timestamp.fromDate(new Date()),
  });

  const archivoPatch = archivo
    ? { archivoPath: nuevoPath, archivoUrl: nuevaUrl, archivoNombre: archivo.name }
    : reemplazarArchivo
    ? {
        archivoPath: deleteField(),
        archivoUrl: deleteField(),
        archivoNombre: deleteField(),
      }
    : {};

  await updateDoc(refDoc, { ...base, ...archivoPatch });
}

export async function deleteSeguimientoCaso(
  clienteParticularId: string,
  casoId: string,
  seguimientoId: string
): Promise<void> {
  const refDoc = doc(
    db,
    `${seguimientoPath(clienteParticularId, casoId)}/${seguimientoId}`
  );
  const snap = await getDoc(refDoc);
  const data = snap.exists() ? (snap.data() as SeguimientoCaso) : null;

  await safeDeleteByPath(data?.archivoPath);
  await deleteDoc(refDoc);

  await registrarEliminacion({
    modulo: "seguimientoCaso",
    descripcion: data?.descripcion ?? seguimientoId,
    coleccionPath: seguimientoPath(clienteParticularId, casoId),
  });
}
