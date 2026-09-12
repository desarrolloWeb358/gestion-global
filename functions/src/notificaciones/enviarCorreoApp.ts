import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {
  sendEmail,
  GMAIL_USER,
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
} from "./sendEmail";
import type { Remitente } from "./sendEmail";

/**
 * Correo suelto disparado desde la app (avisos puntuales a un usuario o a un
 * cliente: reporte habilitado, credenciales, observaciones, seguimientos).
 *
 * Reemplaza a la vieja `enviarNotificacion` (onRequest público + SendGrid), que
 * quedó comentada en index.ts al unificar todo el correo sobre Gmail OAuth2. El
 * frontend seguía llamando su URL de Cloud Run y, al no existir el servicio, la
 * respuesta llegaba sin cabeceras CORS: el navegador lo reportaba como bloqueo
 * de CORS cuando en realidad la función ya no estaba desplegada.
 *
 * Diferencias con aquella: es onCall (exige sesión, sin CORS que configurar) y
 * sale por el mismo `sendEmail` que usan las campañas y el calendario, así que
 * respeta los remitentes verificados.
 *
 * No sustituye a `sendEmailCampaign`: para envíos masivos a deudores sigue
 * usándose la campaña, que encola y reporta progreso.
 */

const REMITENTES_VALIDOS: Remitente[] = ["general", "cartera", "agenda"];

export const enviarCorreoApp = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    secrets: [GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN],
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión para enviar correos.");
    }

    const payload = request.data as {
      to?: unknown;
      subject?: unknown;
      text?: unknown;
      html?: unknown;
      remitente?: unknown;
    };

    const to = String(payload?.to ?? "").trim();
    const subject = String(payload?.subject ?? "").trim();
    const text = payload?.text ? String(payload.text) : undefined;
    const html = payload?.html ? String(payload.html) : undefined;

    if (!to || !subject) {
      throw new HttpsError("invalid-argument", "Faltan parámetros obligatorios: to, subject.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      throw new HttpsError("invalid-argument", `Correo destino inválido: ${to}`);
    }
    if (!text && !html) {
      throw new HttpsError("invalid-argument", "El correo no tiene contenido (text ni html).");
    }

    const remitenteRaw = String(payload?.remitente ?? "general") as Remitente;
    const remitente = REMITENTES_VALIDOS.includes(remitenteRaw) ? remitenteRaw : "general";

    try {
      const messageId = await sendEmail({ to, subject, text, html, remitente });
      logger.info(`[enviarCorreoApp] ${to} · "${subject}" · uid=${request.auth.uid} · ${messageId}`);
      return { ok: true, messageId };
    } catch (error: any) {
      logger.error("[enviarCorreoApp] Error enviando correo:", error);
      throw new HttpsError("internal", error?.message ?? "No se pudo enviar el correo.");
    }
  }
);
