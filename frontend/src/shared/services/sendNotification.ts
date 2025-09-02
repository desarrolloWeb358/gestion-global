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

  const res = await response.json();
  if (!response.ok) throw new Error(res || "Error al enviar notificación");
  return res.resultado;
};