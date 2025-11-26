// src/shared/services/sendNotification.ts
import { TipoNotificacion } from "../constants/notificacionTipos";

export interface NotificationPayload {
  tipo: TipoNotificacion;
  destino: string;
  mensaje?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  archivoUrl?: string;
}

export const sendNotification = async (payload: NotificationPayload): Promise<string> => {
  console.log("Enviando notificación con payload:", payload);

  const response = await fetch("https://enviarnotificacion-prldsxsgzq-uc.a.run.app", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const raw = await response.text(); // 👈 leemos como texto

  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;          // 👈 si es JSON, bien
  } catch {
    // no es JSON, dejamos data = null y usamos raw
  }

  if (!response.ok) {
    console.error("Error HTTP al enviar notificación:", response.status, raw);
    const msg =
      (data && (data.error || data.message)) ||
      raw ||
      "Error al enviar notificación";
    throw new Error(msg);
  }

  // Si vino JSON con { success, resultado }
  if (data && typeof data === "object") {
    return data.resultado ?? JSON.stringify(data);
  }

  // Si vino texto plano pero con 200 OK
  return raw || "OK";
};
