import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {
  GMAIL_USER,
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
} from "../notificaciones/sendEmail";
import {
  avisar,
  destinatarioCliente,
  destinatariosJuridica,
  obtenerClienteInfo,
  rutaValorAgregado,
  tipoLabel,
} from "./shared";

/**
 * Todo lo que pasa cuando alguien escribe en la conversación de un valor agregado,
 * en el backend en vez del navegador.
 *
 * Antes esto vivía en crearMensajeConversacionValorAgregado (frontend) con awaits
 * en serie: si el usuario cerraba la pestaña tras el toast de "Mensaje enviado",
 * el mensaje quedaba guardado y las notificaciones no salían nunca. Es el mismo
 * incidente que ya obligó a mover creación y edición a Cloud Functions.
 *
 * Responsabilidades:
 *   1. Fijar `esperaRespuestaDe` (el turno) y `fechaUltimaActualizacion`.
 *   2. Reabrir el trámite si estaba resuelto y escribe el cliente.
 *   3. Notificar a la contraparte.
 *
 * Ojo: NO toca `estado` salvo para reabrir. Responder no resuelve — resolver es
 * una decisión explícita del abogado (ver estado.ts).
 */

const ETIQUETAS_AUTOR: Record<string, string> = {
  cliente: "Cliente",
  abogado: "Abogado",
  dependiente: "Dependiente",
  admin: "Administrador",
  ejecutivoAdmin: "Ejecutivo administrador",
  ejecutivo: "Ejecutivo",
  supervisor: "Supervisor",
  adminFranquicia: "Administrador de franquicia",
};

function etiquetaAutor(tipo: string): string {
  return ETIQUETAS_AUTOR[tipo] ?? "Un usuario";
}

function contarArchivos(data: any): number {
  if (Array.isArray(data.archivos) && data.archivos.length > 0) {
    return data.archivos.length;
  }
  return data.archivoURL ? 1 : 0;
}

export const procesarMensajeValorAgregado = onDocumentCreated(
  {
    document:
      "clientes/{clienteId}/valoresAgregados/{valorId}/conversacion/{msgId}",
    region: "us-central1",
    secrets: [GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const msg: any = snap.data() || {};
    const { clienteId, valorId } = event.params as {
      clienteId: string;
      valorId: string;
    };

    const db = admin.firestore();
    const vaRef = db.doc(`clientes/${clienteId}/valoresAgregados/${valorId}`);
    const vaSnap = await vaRef.get();
    if (!vaSnap.exists) {
      logger.warn(
        `[procesarMensajeValorAgregado] El valor agregado ${valorId} no existe`
      );
      return;
    }

    const va: any = vaSnap.data() || {};
    const esDelCliente = String(msg.autorTipo || "") === "cliente";

    // ---- 1 y 2: turno, y reapertura si aplica -------------------------------
    // El adjunto NO resuelve por sí solo: el abogado decide cuándo cerrar.
    const patch: any = {
      esperaRespuestaDe: esDelCliente ? "juridica" : "cliente",
      fechaUltimaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Fallback a `completado` por si el documento aún no pasó por la migración.
    const estadoActual =
      va.estado === "abierto" || va.estado === "resuelto"
        ? va.estado
        : va.completado === true
        ? "resuelto"
        : "abierto";

    const reabre = esDelCliente && estadoActual === "resuelto";
    if (reabre) {
      patch.estado = "abierto";
      // fechaResolucion NO se limpia: el reporte mensual la usa como fecha de
      // entrega y el trámite sí llegó a entregarse alguna vez.
      patch.estadoMigradoRevisar = admin.firestore.FieldValue.delete();
      // La notificación de reapertura la dispara estado.ts al ver el cambio.
    }

    // @deprecated — se mantiene sincronizado mientras `completado` siga existiendo.
    patch.completado = reabre ? false : estadoActual === "resuelto";

    try {
      await vaRef.update(patch);
    } catch (err) {
      logger.error(
        `[procesarMensajeValorAgregado] Error actualizando ${valorId}:`,
        err
      );
    }

    // ---- 3: notificar a la contraparte --------------------------------------
    // Si se reabrió, estado.ts ya avisa a jurídica; no duplicamos el correo.
    if (reabre) {
      logger.info(
        `[procesarMensajeValorAgregado] ${valorId} reabierto por el cliente; el aviso lo emite notificarValorAgregadoActualizado`
      );
      return;
    }

    const info = await obtenerClienteInfo(db, clienteId);
    const nombreCliente = info.nombreCliente || clienteId;
    const tipoLbl = tipoLabel(va.tipo);
    const nombreValor = va.titulo || "Documento";
    const ruta = rutaValorAgregado(clienteId, valorId);

    const nArchivos = contarArchivos(msg);
    const resumenAdjuntos =
      nArchivos === 0
        ? ""
        : nArchivos === 1
        ? "<p>El mensaje incluye 1 archivo adjunto.</p>"
        : `<p>El mensaje incluye ${nArchivos} archivos adjuntos.</p>`;

    const ficha = `
      <ul>
        <li><strong>Cliente:</strong> ${nombreCliente}</li>
        <li><strong>Tipo de valor agregado:</strong> ${tipoLbl}</li>
        <li><strong>Título:</strong> ${nombreValor}</li>
      </ul>
    `;

    if (esDelCliente) {
      await avisar({
        db,
        destinatarios: destinatariosJuridica(info),
        ruta,
        descripcionAlerta: `Nuevo mensaje del cliente ${nombreCliente} en el valor agregado (${tipoLbl}): ${nombreValor}`,
        subject: `Nuevo mensaje del cliente en valor agregado: ${tipoLbl}`,
        tituloCorreo: "Nuevo mensaje del cliente en un valor agregado",
        cuerpoHtmlCorreo: `
          <p>El cliente <strong>${nombreCliente}</strong> ha enviado un nuevo mensaje en la conversación de un <strong>valor agregado</strong>.</p>
          ${ficha}${resumenAdjuntos}
          <p>Ingresa a la plataforma para revisar el contenido completo y responder.</p>
        `,
        logTag: "procesarMensajeValorAgregado",
      });
    } else {
      const autorLabel = etiquetaAutor(String(msg.autorTipo || ""));
      await avisar({
        db,
        destinatarios: [destinatarioCliente(clienteId, info)],
        ruta,
        descripcionAlerta: `Nuevo mensaje de ${autorLabel.toLowerCase()} en el valor agregado (${tipoLbl}): ${nombreValor}`,
        subject: `Nuevo mensaje en tu valor agregado: ${tipoLbl}`,
        tituloCorreo: `Nuevo mensaje de ${autorLabel.toLowerCase()} en un valor agregado`,
        cuerpoHtmlCorreo: `
          <p>${autorLabel} ha enviado un nuevo mensaje en la conversación de un <strong>valor agregado</strong>.</p>
          ${ficha}${resumenAdjuntos}
          <p>Ingresa a la plataforma para revisar el contenido completo y responder.</p>
        `,
        logTag: "procesarMensajeValorAgregado",
      });
    }

    logger.info(
      `[procesarMensajeValorAgregado] Mensaje procesado en ${valorId} (autor: ${msg.autorTipo}, turno → ${patch.esperaRespuestaDe})`
    );
  }
);
