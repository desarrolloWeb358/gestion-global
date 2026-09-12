// src/shared/services/sendNotification.ts
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";

/**
 * Único punto de salida de los correos sueltos de la app (reporte habilitado,
 * credenciales, observaciones, seguimientos de casos).
 *
 * Antes esto hacía `fetch` a la URL de Cloud Run de `enviarNotificacion`. Esa
 * función se comentó en functions/src/index.ts al pasar todo el correo a Gmail
 * OAuth2, el servicio dejó de existir y el navegador empezó a reportarlo como
 * bloqueo de CORS (la respuesta de un servicio inexistente no trae cabeceras
 * CORS). Ahora va por el callable `enviarCorreoApp`, que sale por el mismo
 * `sendEmail` que las campañas y el calendario.
 */

/** Desde cuál de las direcciones verificadas sale. Ver REMITENTES en functions. */
export type RemitenteCorreo = "general" | "cartera" | "agenda";

export interface EmailNotificationPayload {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  remitente?: RemitenteCorreo;
}

export const sendNotification = async (
  payload: EmailNotificationPayload
): Promise<string> => {
  const enviar = httpsCallable<EmailNotificationPayload, { ok: boolean; messageId?: string }>(
    functions,
    "enviarCorreoApp"
  );

  const { data } = await enviar(payload);
  return data?.messageId || "ok";
};
