import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
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
  destinatariosJuridica,
  obtenerClienteInfo,
  rutaValorAgregado,
  tipoLabel,
} from "./shared";
import { detectarTransicionEstado, notificarTransicionEstado } from "./estado";

// Dispara la notificación (alerta + correo) de "valor agregado" desde el
// backend en vez del navegador, para que no dependa de que el fetch desde
// el cliente llegue a tiempo (ver incidente: alerta creada pero correo
// nunca enviado porque el navegador no completó la llamada a enviarNotificacion).

export const notificarValorAgregadoCreado = onDocumentCreated(
  {
    document: "clientes/{clienteId}/valoresAgregados/{valorId}",
    region: "us-central1",
    secrets: [GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data: any = snap.data();
    const { clienteId, valorId } = event.params as { clienteId: string; valorId: string };

    const db = admin.firestore();
    const info = await obtenerClienteInfo(db, clienteId);
    const destinatarios = destinatariosJuridica(info);

    if (destinatarios.length === 0) {
      logger.warn(
        `[notificarValorAgregadoCreado] Cliente ${clienteId} sin abogadoId ni dependienteAbogadoId; no hay a quién notificar`
      );
      return;
    }

    const tipoLbl = tipoLabel(data.tipo);
    const nombreValor = data.titulo || "Documento";
    const nombreCliente = info.nombreCliente || clienteId;

    await avisar({
      db,
      destinatarios,
      ruta: rutaValorAgregado(clienteId, valorId),
      descripcionAlerta: `Nuevo valor agregado (${tipoLbl}) para el cliente ${nombreCliente}: ${nombreValor}`,
      subject: `Nuevo valor agregado: ${tipoLbl}`,
      tituloCorreo: "Se ha registrado un nuevo valor agregado",
      cuerpoHtmlCorreo: `
        <p>Se ha registrado un nuevo <strong>valor agregado</strong> en la plataforma.</p>
        <ul>
          <li><strong>Cliente:</strong> ${nombreCliente}</li>
          <li><strong>Tipo:</strong> ${tipoLbl}</li>
          <li><strong>Nombre:</strong> ${nombreValor}</li>
        </ul>
        <p>Ingresa a la plataforma para revisar el detalle completo.</p>
      `,
      logTag: "notificarValorAgregadoCreado",
    });

    logger.info(
      `[notificarValorAgregadoCreado] Notificación procesada para valor ${valorId} del cliente ${clienteId}`
    );
  }
);

// Solo estos campos representan una edición real hecha desde el formulario.
// "archivos"/"estado"/"esperaRespuestaDe"/"fechaResolucion"/"fechaUltimaActualizacion"
// cambian por otros flujos (adjuntar al crear, responder, resolver) que tienen su
// propia notificación y no deben disparar la de "valor agregado modificado".
const CAMPOS_RELEVANTES = ["tipo", "titulo", "descripcion", "fecha"] as const;

function huboCambioRelevante(before: any, after: any): boolean {
  return CAMPOS_RELEVANTES.some((campo) => {
    const b = before?.[campo];
    const a = after?.[campo];
    if (b instanceof admin.firestore.Timestamp && a instanceof admin.firestore.Timestamp) {
      return !b.isEqual(a);
    }
    return b !== a;
  });
}

/**
 * ÚNICO trigger onUpdate sobre `clientes/{c}/valoresAgregados/{v}`.
 *
 * Antes había dos escuchando esta misma ruta (esta y la de estado): cada
 * escritura levantaba las dos funciones y cada una releía cliente + abogado +
 * dependiente por su cuenta, aunque una terminara sin hacer nada. Ahora se
 * decide primero qué pasó, se leen los datos del cliente una sola vez y se
 * despacha. Si la escritura no fue ni edición ni transición de estado —el caso
 * más común: adjuntar archivos, mover el turno, tocar fechaUltimaActualizacion—
 * salimos sin una sola lectura extra.
 */
export const notificarValorAgregadoActualizado = onDocumentUpdated(
  {
    document: "clientes/{clienteId}/valoresAgregados/{valorId}",
    region: "us-central1",
    secrets: [GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN],
  },
  async (event) => {
    const change = event.data;
    if (!change) return;

    const before: any = change.before.data();
    const after: any = change.after.data();

    const huboEdicion = huboCambioRelevante(before, after);
    const transicion = detectarTransicionEstado(before, after);

    if (!huboEdicion && !transicion) return;

    const { clienteId, valorId } = event.params as { clienteId: string; valorId: string };
    const db = admin.firestore();
    const info = await obtenerClienteInfo(db, clienteId);

    // Resolver y reabrir avisan a destinatarios distintos (cliente vs jurídica),
    // por eso esta rama vive en estado.ts y no comparte cuerpo con la edición.
    if (transicion) {
      await notificarTransicionEstado({
        db,
        clienteId,
        valorId,
        after,
        info,
        estadoDespues: transicion,
      });
    }

    if (!huboEdicion) return;

    const destinatarios = destinatariosJuridica(info);
    if (destinatarios.length === 0) {
      logger.warn(
        `[notificarValorAgregadoActualizado] Cliente ${clienteId} sin abogadoId ni dependienteAbogadoId; no hay a quién notificar`
      );
      return;
    }

    const tipoLbl = tipoLabel(after.tipo);
    const nombreValor = after.titulo || "Documento";
    const nombreCliente = info.nombreCliente || clienteId;

    await avisar({
      db,
      destinatarios,
      ruta: rutaValorAgregado(clienteId, valorId),
      descripcionAlerta: `Se ha modificado el valor agregado (${tipoLbl}) del cliente ${nombreCliente}: ${nombreValor}`,
      subject: `Valor agregado modificado: ${tipoLbl} - ${nombreCliente}`,
      tituloCorreo: "Se ha modificado un valor agregado",
      cuerpoHtmlCorreo: `
        <p>Se ha <strong>modificado</strong> un valor agregado en la plataforma.</p>
        <ul>
          <li><strong>Cliente:</strong> ${nombreCliente}</li>
          <li><strong>Tipo:</strong> ${tipoLbl}</li>
          <li><strong>Nombre:</strong> ${nombreValor}</li>
        </ul>
        <p>Ingresa a la plataforma para revisar el detalle completo.</p>
      `,
      logTag: "notificarValorAgregadoActualizado",
    });

    logger.info(
      `[notificarValorAgregadoActualizado] Notificación procesada para valor ${valorId} del cliente ${clienteId}`
    );
  }
);
