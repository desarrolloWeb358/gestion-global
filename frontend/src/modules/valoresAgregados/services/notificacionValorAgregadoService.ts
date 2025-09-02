
import { sendNotification } from "@/shared/services/sendNotification";
import { TipoNotificacion } from "@/shared/constants/notificacionTipos";
import { NotificationTemplates } from "@/shared/constants/notificationTemplates";

type Destinatarios = {
  correoCliente?: string;
  whatsappCliente?: string; // en formato E.164 (+57...)
};

type PayloadBasico = {
  nombreCliente: string; // 👈 NUEVO: para {{1}} del template WA
  tipoLabel: string;     // p.ej. "Derecho de Petición" → {{2}}
  nombreValor: string;   // p.ej. "DP-2025-001"         → {{3}}
};

export async function enviarNotificacionValorAgregadoBasico(
  destinatarios: Destinatarios,
  data: PayloadBasico
): Promise<string[]> {
  const resultados: string[] = [];
  const cfg = NotificationTemplates.VALOR_AGREGADO;

  // --- WhatsApp (si está habilitado y hay destinatario)
  if (cfg.WHATSAPP_ENABLED && destinatarios.whatsappCliente) {
    const r = await sendNotification({
      tipo: TipoNotificacion.WHATSAPP,
      destino: destinatarios.whatsappCliente,
      templateId: cfg.WHATSAPP_TEMPLATE_ID,
      // Orden de variables Twilio:
      // {{1}} = nombreCliente, {{2}} = tipoLabel, {{3}} = nombreValor
      templateData: {
        "1": data.nombreCliente || "Cliente",
        "2": data.tipoLabel,
        "3": data.nombreValor,
      },
    });
    resultados.push(`WA cliente: ${r}`);
  }

  // --- Email (si está habilitado y hay correo)
  if (cfg.EMAIL_ENABLED && destinatarios.correoCliente) {
    const r = await sendNotification({
      tipo: TipoNotificacion.CORREO,
      destino: destinatarios.correoCliente,
      templateId: cfg.EMAIL_TEMPLATE_ID,
      // Ajusta nombres de variables a como esté tu SendGrid dynamic template
      templateData: {
        cliente: data.nombreCliente || "Cliente",
        tipo: data.tipoLabel,
        nombre: data.nombreValor,
      },
    });
    resultados.push(`Email cliente: ${r}`);
  }

  // --- SMS (si está habilitado y quieres también SMS)
  if (cfg.SMS_ENABLED && destinatarios.whatsappCliente) {
    // si quieres otro número de SMS aparte, pásalo desde el caller
    const telefonoSms = destinatarios.whatsappCliente.replace(/^whatsapp:/, "");
    const r = await sendNotification({
      tipo: TipoNotificacion.SMS,
      destino: telefonoSms,
      mensaje: `Hola ${data.nombreCliente || "Cliente"}, se creó un valor agregado. Tipo: ${data.tipoLabel}. Nombre: ${data.nombreValor}.`,
    });
    resultados.push(`SMS cliente: ${r}`);
  }

  return resultados;
}
