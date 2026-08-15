import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {
  GMAIL_USER,
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  sendEmail,
} from "../notificaciones/sendEmail";

// Dispara la notificación (alerta + correo) de "valor agregado" desde el
// backend en vez del navegador, para que no dependa de que el fetch desde
// el cliente llegue a tiempo (ver incidente: alerta creada pero correo
// nunca enviado porque el navegador no completó la llamada a enviarNotificacion).

const TIPO_LABELS: Record<string, string> = {
  "derecho de peticion": "Derecho de Petición",
  tutela: "Tutela",
  desacato: "Desacato",
  "estudios contratos": "Estudios / Contratos",
};

function tipoLabel(tipo: unknown): string {
  const key = String(tipo ?? "");
  return TIPO_LABELS[key] ?? key ?? "Valor agregado";
}

type ClienteInfo = {
  abogadoId?: string;
  correoAbogado?: string;
  nombreAbogado?: string;
  dependienteAbogadoId?: string;
  correoDepAbogado?: string;
  nombreDepAbogado?: string;
  nombreCliente?: string;
};

async function obtenerClienteInfo(
  db: FirebaseFirestore.Firestore,
  clienteId: string
): Promise<ClienteInfo> {
  const cSnap = await db.doc(`clientes/${clienteId}`).get();
  if (!cSnap.exists) return {};

  const cData: any = cSnap.data() || {};
  const abogadoId: string | undefined = cData.abogadoId || undefined;
  const dependienteAbogadoId: string | undefined = cData.dependienteAbogadoId || undefined;
  const nombreCliente: string | undefined = cData.nombre;

  let correoAbogado: string | undefined;
  let nombreAbogado = "Abogado";
  if (abogadoId) {
    const abSnap = await db.doc(`usuarios/${abogadoId}`).get();
    if (abSnap.exists) {
      const abData: any = abSnap.data() || {};
      correoAbogado = abData.email;
      nombreAbogado = abData.nombre || "Abogado";
    }
  }

  let correoDepAbogado: string | undefined;
  let nombreDepAbogado = "Asistente Jurídico";
  if (dependienteAbogadoId) {
    const depSnap = await db.doc(`usuarios/${dependienteAbogadoId}`).get();
    if (depSnap.exists) {
      const depData: any = depSnap.data() || {};
      correoDepAbogado = depData.email;
      nombreDepAbogado = depData.nombre || "Asistente Jurídico";
    }
  }

  return {
    abogadoId,
    correoAbogado,
    nombreAbogado,
    dependienteAbogadoId,
    correoDepAbogado,
    nombreDepAbogado,
    nombreCliente,
  };
}

function buildEmailHtml(nombreDestinatario: string, titulo: string, cuerpoHtml: string): string {
  return `
    <!doctype html>
    <html lang="es">
    <head><meta charset="utf-8" /><title>${titulo}</title></head>
    <body style="margin:0;padding:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background-color:#f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 10px 15px rgba(0,0,0,0.05);">
            <tr><td style="background:#111827;color:#f9fafb;padding:16px 24px;">
              <h1 style="margin:0;font-size:20px;">Gestión Global</h1>
              <p style="margin:4px 0 0;font-size:13px;opacity:0.8;">Plataforma de gestión de cartera</p>
            </td></tr>
            <tr><td style="padding:24px;">
              <p style="margin-top:0;margin-bottom:12px;font-size:14px;">Hola <strong>${nombreDestinatario}</strong>,</p>
              <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">${titulo}</h2>
              <div style="font-size:14px;color:#374151;line-height:1.5;">${cuerpoHtml}</div>
              <p style="margin-top:24px;font-size:12px;color:#6b7280;">
                Si no reconoces esta notificación, por favor comunícate con el equipo de soporte de Gestión Global.
              </p>
            </td></tr>
            <tr><td style="background:#f9fafb;padding:16px 24px;text-align:center;font-size:11px;color:#9ca3af;">
              © ${new Date().getFullYear()} Gestión Global. Todos los derechos reservados.
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

async function notificarDestinatario(params: {
  db: FirebaseFirestore.Firestore;
  usuarioId: string;
  nombreDestino: string;
  correoDestino?: string;
  ruta: string;
  descripcionAlerta: string;
  subject: string;
  tituloCorreo: string;
  cuerpoHtmlCorreo: string;
  logTag: string;
}): Promise<void> {
  const {
    db,
    usuarioId,
    nombreDestino,
    correoDestino,
    ruta,
    descripcionAlerta,
    subject,
    tituloCorreo,
    cuerpoHtmlCorreo,
    logTag,
  } = params;

  try {
    await db.collection(`usuarios/${usuarioId}/notificaciones`).add({
      descripcion: descripcionAlerta,
      ruta,
      modulo: "valor agregado",
      visto: false,
      fecha: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    logger.error(`[${logTag}] Error creando alerta para ${usuarioId}:`, err);
  }

  if (!correoDestino) {
    logger.warn(`[${logTag}] Usuario ${usuarioId} sin correo, no se envía email`);
    return;
  }

  try {
    await sendEmail({
      to: correoDestino,
      subject,
      text: `${tituloCorreo}\n\n${descripcionAlerta}`,
      html: buildEmailHtml(nombreDestino, tituloCorreo, cuerpoHtmlCorreo),
    });
  } catch (err) {
    logger.error(`[${logTag}] Error enviando correo a ${usuarioId}:`, err);
  }
}

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
    const clienteInfo = await obtenerClienteInfo(db, clienteId);
    const { abogadoId, dependienteAbogadoId, nombreCliente } = clienteInfo;

    if (!abogadoId && !dependienteAbogadoId) {
      logger.warn(
        `[notificarValorAgregadoCreado] Cliente ${clienteId} sin abogadoId ni dependienteAbogadoId; no hay a quién notificar`
      );
      return;
    }

    const tipoLbl = tipoLabel(data.tipo);
    const nombreValor = data.titulo || "Documento";
    const ruta = `/clientes/${clienteId}/valores-agregados/${valorId}`;
    const descripcionAlerta = `Nuevo valor agregado (${tipoLbl}) para el cliente ${nombreCliente}: ${nombreValor}`;
    const subject = `Nuevo valor agregado: ${tipoLbl}`;
    const tituloCorreo = "Se ha registrado un nuevo valor agregado";
    const cuerpoHtmlCorreo = `
      <p>Se ha registrado un nuevo <strong>valor agregado</strong> en la plataforma.</p>
      <ul>
        <li><strong>Cliente:</strong> ${nombreCliente}</li>
        <li><strong>Tipo:</strong> ${tipoLbl}</li>
        <li><strong>Nombre:</strong> ${nombreValor}</li>
      </ul>
      <p>Tienes una nueva actualización. Ingresa a la plataforma para revisar el detalle completo.</p>
    `;

    if (abogadoId) {
      await notificarDestinatario({
        db,
        usuarioId: abogadoId,
        nombreDestino: clienteInfo.nombreAbogado ?? "Abogado",
        correoDestino: clienteInfo.correoAbogado,
        ruta,
        descripcionAlerta,
        subject,
        tituloCorreo,
        cuerpoHtmlCorreo,
        logTag: "notificarValorAgregadoCreado",
      });
    }
    if (dependienteAbogadoId) {
      await notificarDestinatario({
        db,
        usuarioId: dependienteAbogadoId,
        nombreDestino: clienteInfo.nombreDepAbogado ?? "Asistente Jurídico",
        correoDestino: clienteInfo.correoDepAbogado,
        ruta,
        descripcionAlerta,
        subject,
        tituloCorreo,
        cuerpoHtmlCorreo,
        logTag: "notificarValorAgregadoCreado",
      });
    }

    logger.info(
      `[notificarValorAgregadoCreado] Notificación procesada para valor ${valorId} del cliente ${clienteId}`
    );
  }
);

// Solo estos campos representan una edición real hecha desde el formulario;
// "archivos"/"completado"/"fechaCompletado"/"fechaUltimaActualizacion" cambian
// por otros flujos (adjuntar archivo al crear, responder en la conversación)
// que no deben disparar la notificación de "valor agregado modificado".
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

    if (!huboCambioRelevante(before, after)) return;

    const { clienteId, valorId } = event.params as { clienteId: string; valorId: string };
    const db = admin.firestore();
    const clienteInfo = await obtenerClienteInfo(db, clienteId);
    const { abogadoId, dependienteAbogadoId, nombreCliente } = clienteInfo;

    if (!abogadoId && !dependienteAbogadoId) {
      logger.warn(
        `[notificarValorAgregadoActualizado] Cliente ${clienteId} sin abogadoId ni dependienteAbogadoId; no hay a quién notificar`
      );
      return;
    }

    const tipoLbl = tipoLabel(after.tipo);
    const nombreValor = after.titulo || "Documento";
    const ruta = `/clientes/${clienteId}/valores-agregados/${valorId}`;
    const descripcionAlerta = `Se ha modificado el valor agregado (${tipoLbl}) del cliente ${nombreCliente}: ${nombreValor}`;
    const subject = `Valor agregado modificado: ${tipoLbl} - ${nombreCliente}`;
    const tituloCorreo = "Se ha modificado un valor agregado";
    const cuerpoHtmlCorreo = `
      <p>Se ha <strong>modificado</strong> un valor agregado en la plataforma.</p>
      <ul>
        <li><strong>Cliente:</strong> ${nombreCliente}</li>
        <li><strong>Tipo:</strong> ${tipoLbl}</li>
        <li><strong>Nombre:</strong> ${nombreValor}</li>
      </ul>
      <p>Tienes una actualización. Ingresa a la plataforma para revisar el detalle completo.</p>
    `;

    if (abogadoId) {
      await notificarDestinatario({
        db,
        usuarioId: abogadoId,
        nombreDestino: clienteInfo.nombreAbogado ?? "Abogado",
        correoDestino: clienteInfo.correoAbogado,
        ruta,
        descripcionAlerta,
        subject,
        tituloCorreo,
        cuerpoHtmlCorreo,
        logTag: "notificarValorAgregadoActualizado",
      });
    }
    if (dependienteAbogadoId) {
      await notificarDestinatario({
        db,
        usuarioId: dependienteAbogadoId,
        nombreDestino: clienteInfo.nombreDepAbogado ?? "Asistente Jurídico",
        correoDestino: clienteInfo.correoDepAbogado,
        ruta,
        descripcionAlerta,
        subject,
        tituloCorreo,
        cuerpoHtmlCorreo,
        logTag: "notificarValorAgregadoActualizado",
      });
    }

    logger.info(
      `[notificarValorAgregadoActualizado] Notificación procesada para valor ${valorId} del cliente ${clienteId}`
    );
  }
);
