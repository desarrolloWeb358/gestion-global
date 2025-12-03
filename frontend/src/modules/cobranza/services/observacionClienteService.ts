// src/modules/cobranza/services/observacionClienteService.ts
import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  type CollectionReference,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { ObservacionCliente } from "../models/observacionCliente.model";
import type { Cliente } from "@/modules/clientes/models/cliente.model";
import { notificarUsuarioConAlertaYCorreo } from "../../notificaciones/services/notificacionService";

type Scope = "deudor" | "valor";

// Estructura exacta que se guarda en Firestore
type ObservacionClienteDoc = {
  texto: string;
  fecha: Timestamp; // único campo temporal
};

function colPath(clienteId: string, parentId: string, scope: Scope): string {
  return scope === "deudor"
    ? `clientes/${clienteId}/deudores/${parentId}/observacionesCliente`
    : `clientes/${clienteId}/valoresAgregados/${parentId}/observacionesCliente`;
}

function colRef(
  clienteId: string,
  parentId: string,
  scope: Scope
) {
  return collection(
    db,
    colPath(clienteId, parentId, scope)
  ) as CollectionReference<ObservacionClienteDoc>;
}

/* ========== READ (lista) ========== */
export async function getObservacionesClienteGeneric(
  clienteId: string,
  parentId: string,
  scope: Scope
): Promise<ObservacionCliente[]> {
  const q = query(colRef(clienteId, parentId, scope), orderBy("fecha", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data(); // { texto, fecha }
    const item: ObservacionCliente = {
      id: d.id,
      texto: data.texto ?? "",
      fecha: data.fecha ?? null,
    };
    return item;
  });
}

/* ========== CREATE ========== */
export async function addObservacionClienteGeneric(
  clienteId: string,
  parentId: string,
  texto: string,
  scope: Scope
): Promise<string> {
  const ref = await addDoc(colRef(clienteId, parentId, scope), {
    texto,
    fecha: serverTimestamp() as unknown as Timestamp, // único timestamp
  });
  return ref.id;
}

/* ========== UPDATE ========== */
export async function updateObservacionClienteGeneric(
  clienteId: string,
  parentId: string,
  obsId: string,
  nuevoTexto: string,
  scope: Scope
): Promise<void> {
  const ref = doc(db, `${colPath(clienteId, parentId, scope)}/${obsId}`);
  await updateDoc(ref, { texto: nuevoTexto }); // no tocamos `fecha`
}

/* ========== DELETE ========== */
export async function deleteObservacionClienteGeneric(
  clienteId: string,
  parentId: string,
  obsId: string,
  scope: Scope
): Promise<void> {
  const ref = doc(db, `${colPath(clienteId, parentId, scope)}/${obsId}`);
  await deleteDoc(ref);
}

/* ===== Facades por scope (deudor / valor) ===== */
export async function getObservacionesCliente(
  clienteId: string,
  deudorId: string
): Promise<ObservacionCliente[]> {
  return getObservacionesClienteGeneric(clienteId, deudorId, "deudor");
}

export async function addObservacionCliente(
  clienteId: string,
  deudorId: string,
  texto: string
): Promise<string> {
  return addObservacionClienteGeneric(clienteId, deudorId, texto, "deudor");
}

export async function getObservacionesClienteValor(
  clienteId: string,
  valorId: string
): Promise<ObservacionCliente[]> {
  return getObservacionesClienteGeneric(clienteId, valorId, "valor");
}

export async function addObservacionClienteValor(
  clienteId: string,
  valorId: string,
  texto: string
): Promise<string> {
  return addObservacionClienteGeneric(clienteId, valorId, texto, "valor");
}

export async function updateObservacionCliente(
  clienteId: string,
  parentId: string,
  obsId: string,
  nuevoTexto: string,
  scope: Scope = "deudor"
): Promise<void> {
  return updateObservacionClienteGeneric(
    clienteId,
    parentId,
    obsId,
    nuevoTexto,
    scope
  );
}

export async function deleteObservacionCliente(
  clienteId: string,
  parentId: string,
  obsId: string,
  scope: Scope = "deudor"
): Promise<void> {
  return deleteObservacionClienteGeneric(
    clienteId,
    parentId,
    obsId,
    scope
  );
}

/* =======================================================
 * NOTIFICACIONES (alerta + correo al responsable)
 * ======================================================= */

const APP_BASE_URL =
  (import.meta as any).env?.VITE_APP_URL ?? window.location.origin;

/**
 * Lee el cliente y decide qué uid usar como destino de la notificación.
 * Prioridad simple: prejurídico → jurídico → dependiente → abogado.
 */
async function obtenerUsuarioDestinoDesdeCliente(
  clienteId: string
): Promise<string | null> {
  const ref = doc(db, `clientes/${clienteId}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data() as Cliente;

  return (
    data.ejecutivoPrejuridicoId ||
    data.ejecutivoJuridicoId ||
    data.ejecutivoDependienteId ||
    data.abogadoId ||
    null
  );
}

/**
 * Cliente escribe observación sobre DEUDOR → se crea la observación
 * y se notifica al responsable (alerta en subcolección + correo).
 */
export async function addObservacionDeudorConNotificacion(params: {
  clienteId: string;
  deudorId: string;
  texto: string;
  nombreCliente?: string;
  nombreDeudor?: string;
}) {
  const { clienteId, deudorId, texto, nombreCliente, nombreDeudor } = params;

  // 1) Crear observación normal
  const obsId = await addObservacionClienteGeneric(
    clienteId,
    deudorId,
    texto,
    "deudor"
  );

  // 2) Buscar a quién notificar
  const usuarioDestinoId = await obtenerUsuarioDestinoDesdeCliente(clienteId);
  if (!usuarioDestinoId) {
    console.warn(
      `[addObservacionDeudorConNotificacion] Cliente ${clienteId} no tiene responsable configurado`
    );
    return obsId;
  }

  const nombreCli = nombreCliente ?? "Cliente";
  const nombreDeu = nombreDeudor ?? "deudor";

  const descripcionAlerta = `Nueva observación de ${nombreCli} sobre el deudor ${nombreDeu}`;
  const ruta = `/clientes/${clienteId}/deudores/${deudorId}?tab=observaciones`;

  const cuerpoHtmlCorreo = `
    <p>El cliente <strong>${nombreCli}</strong> ha registrado una nueva observación sobre el deudor <strong>${nombreDeu}</strong>.</p>
    <p style="margin-top:12px;padding:12px;border-radius:6px;background:#f3f4f6;font-style:italic;">
      "${texto}"
    </p>
    <p style="margin-top:12px;">
      Ingresa a la plataforma de Gestión Global para revisar el comentario y realizar el seguimiento correspondiente.
    </p>
  `;

  await notificarUsuarioConAlertaYCorreo({
    usuarioId: usuarioDestinoId,
    modulo: "seguimiento",
    ruta,
    descripcionAlerta,
    subject: "Nueva observación de cliente sobre un deudor",
    tituloCorreo: "Tienes una nueva observación registrada por un cliente",
    cuerpoHtmlCorreo,
    accionUrl: `${APP_BASE_URL}${ruta}`,
    accionTexto: "Ver observación",
  });

  return obsId;
}
