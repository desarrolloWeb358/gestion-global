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
  updateDoc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { ObservacionCliente } from "../models/observacionCliente.model";
import { notificarUsuarioConAlertaYCorreo } from "@/modules/notificaciones/services/notificacionService";

type Scope = "deudor" | "valor";

// Estructura exacta que se guarda en Firestore
type ObservacionClienteDoc = {
  texto: string;
  fecha: Timestamp; // único campo temporal
};

type ClienteInfoEjecutivoPre = {
  ejecutivoPrejuridicoId?: string;
  nombreCliente?: string;
};

async function obtenerClienteInfoParaNotificacionObservacion(
  clienteId: string
): Promise<ClienteInfoEjecutivoPre> {
  const cSnap = await getDoc(doc(db, `clientes/${clienteId}`));

  if (!cSnap.exists()) {
    console.warn(
      `[obtenerClienteInfoParaNotificacionObservacion] Cliente ${clienteId} no existe`
    );
    return {};
  }

  const cData: any = cSnap.data() || {};

  // 🔧 Ajusta el nombre del campo si en tu colección se llama distinto
  const ejecutivoPrejuridicoId: string | undefined = cData.ejecutivoPrejuridicoId;
  const nombreCliente: string | undefined = cData.nombre;

  if (!ejecutivoPrejuridicoId) {
    console.warn(
      `[obtenerClienteInfoParaNotificacionObservacion] Cliente ${clienteId} no tiene ejecutivoPrejuridicoId definido`
    );
  }

  return { ejecutivoPrejuridicoId, nombreCliente };
}

async function obtenerNombreDeudorPorId(
  clienteId: string,
  deudorId: string
): Promise<string | undefined> {
  try {
    const deudorRef = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
    const snap = await getDoc(deudorRef);

    if (!snap.exists()) {
      console.warn(
        `[obtenerNombreDeudorPorId] Deudor ${deudorId} no existe para el cliente ${clienteId}`
      );
      return undefined;
    }

    const data: any = snap.data() || {};
    // Ajusta el campo si en tu colección se llama distinto (nombreCompleto, displayName, etc.)
    return data.nombre || data.nombreCompleto || data.displayName || undefined;
  } catch (err) {
    console.error(
      "[obtenerNombreDeudorPorId] Error leyendo deudor:",
      err
    );
    return undefined;
  }
}



function colPath(clienteId: string, parentId: string, scope: Scope): string {
  return scope === "deudor"
    ? `clientes/${clienteId}/deudores/${parentId}/observacionesCliente`
    : `clientes/${clienteId}/valoresAgregados/${parentId}/observacionesCliente`;
}

function colRef(clienteId: string, parentId: string, scope: Scope) {
  return collection(db, colPath(clienteId, parentId, scope)) as CollectionReference<ObservacionClienteDoc>;
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
/* ========== CREATE ========== */
export async function addObservacionClienteGeneric(
  clienteId: string,
  parentId: string,
  texto: string,
  scope: Scope
): Promise<string> {
  // 1️⃣ Guardar la observación en Firestore
  const ref = await addDoc(colRef(clienteId, parentId, scope), {
    texto,
    fecha: serverTimestamp() as unknown as Timestamp, // único timestamp
  });
  const obsId = ref.id;

    // 2️⃣ Notificar SOLO cuando es observación a nivel deudor (seguimiento)
  if (scope === "deudor") {
    try {
      // Info del cliente: nombre + ejecutivo pre-jurídico
      const clienteInfo = await obtenerClienteInfoParaNotificacionObservacion(
        clienteId
      );
      const ejecutivoPreJuridicoId = clienteInfo.ejecutivoPrejuridicoId;

      if (!ejecutivoPreJuridicoId) {
        console.warn(
          `[addObservacionClienteGeneric] Cliente ${clienteId} sin ejecutivoPreJuridicoId; no se envía notificación.`
        );
        return obsId;
      }

      const nombreCliente = clienteInfo.nombreCliente || clienteId;

      // 🔍 Obtener nombre del deudor (parentId = deudorId = usuarioId)
      const nombreDeudor =
        (await obtenerNombreDeudorPorId(clienteId, parentId)) || parentId;

      // Texto corto del mensaje (podrías recortarlo si quieres)
      const textoMsg = (texto || "").trim();

      // Ruta interna a la pantalla de seguimiento (ajusta si tu ruta real es distinta)
      const ruta = `/clientes/${clienteId}/deudores/${parentId}/seguimiento`;

      // 📝 Esta descripción es la que se guarda en la notificación en BD
      const descripcionAlerta = `Nueva observación del cliente ${nombreCliente} sobre el deudor ${nombreDeudor}: ${textoMsg}`;

      const subject = `Nueva observación del cliente sobre el deudor ${nombreDeudor}`;
      const tituloCorreo = `Nueva observación registrada por el cliente`;

      const cuerpoHtmlCorreo = `
        <p>El cliente <strong>${nombreCliente}</strong> ha registrado una nueva <strong>observación</strong> en el seguimiento pre-jurídico.</p>
        <ul>
          <li><strong>Cliente:</strong> ${nombreCliente}</li>
          <li><strong>Deudor:</strong> ${nombreDeudor}</li>
        </ul>
        <p><strong>Observación del cliente sobre ${nombreDeudor}:</strong></p>
        <p>${textoMsg || "(sin texto)"}</p>
        <p>Puedes ingresar a la plataforma para revisar el detalle completo y tomar acción.</p>
      `;

      await notificarUsuarioConAlertaYCorreo({
        usuarioId: ejecutivoPreJuridicoId,
        modulo: "observacion_cliente",
        ruta,
        descripcionAlerta,
        subject,
        tituloCorreo,
        cuerpoHtmlCorreo,
        accionUrl: `${window.location.origin}#${ruta}`,
        accionTexto: "Ver observaciones",
      });
    } catch (err) {
      console.error(
        "[addObservacionClienteGeneric] Error al notificar al ejecutivo pre-jurídico:",
        err
      );
    }
  }


  return obsId;
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
  return updateObservacionClienteGeneric(clienteId, parentId, obsId, nuevoTexto, scope);
}

export async function deleteObservacionCliente(
  clienteId: string,
  parentId: string,
  obsId: string,
  scope: Scope = "deudor"
): Promise<void> {
  return deleteObservacionClienteGeneric(clienteId, parentId, obsId, scope);
}
