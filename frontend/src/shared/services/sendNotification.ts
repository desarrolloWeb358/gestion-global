// src/shared/services/sendNotification.ts
import { TipoNotificacion } from "../constants/notificacionTipos";

export interface EmailNotificationPayload {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export const sendNotification = async (
  payload: EmailNotificationPayload
): Promise<string> => {
  console.log("Enviando notificación con payload:", payload);

  const response = await fetch(
    "https://enviarnotificacion-prldsxsgzq-uc.a.run.app",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  const res = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Error HTTP al enviar notificación:", res);
    throw new Error(res || "Error al enviar notificación");
  }

  return res.messageId || "ok";
};
