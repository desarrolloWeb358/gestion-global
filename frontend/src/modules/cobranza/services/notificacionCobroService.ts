// src/modules/cobranza/services/NotificacionCobroService.ts
import { Deudor } from "../models/deudores.model";
import { sendNotification } from "@/shared/services/sendNotification";
import { TipoNotificacion } from "@/shared/constants/notificacionTipos";
import { NotificationTemplates } from "@/shared/constants/notificationTemplates";

/**
 * Opcionales para parametrizar monto y link de pago desde la pantalla que llame.
 */
type CobroOptions = {
  montoCOP?: number;       // si no lo pasas, se mostrará $0
  enlacePago?: string;     // opcional
};

const formatCOP = (value = 0) =>
  value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

/**
 * 👉 Envío unitario: arma y envía por los canales activos para COBRO.
 *   - Conoce plantillas y canales por dentro (usa NotificationTemplates.COBRO).
 */
export const enviarNotificacionCobro = async (
  deudor: Deudor,
  opts?: CobroOptions
) => {
  console.log(`Enviando notificación de COBRO para el inmueble/deudor ${deudor.id}...`);
  const resultados: string[] = [];

  const nombre   = (deudor as any).nombre || "Usuario"; // ajusta si tu modelo usa `responsable`
  const telefono = deudor.telefonos?.[0];
  const correo   = deudor.correos?.[0];
  const deudaStr = formatCOP(opts?.montoCOP ?? 0);
  const enlace   = opts?.enlacePago ?? "";

  // --- SMS (si está habilitado globalmente y hay teléfono)
  if (NotificationTemplates.COBRO.SMS_ENABLED && telefono) {
    console.log(`Enviando SMS a ${telefono}...`);
    const mensaje = `Hola ${nombre}, le recordamos su deuda pendiente por ${deudaStr}. ${
      enlace ? `Pague aquí: ${enlace}` : ""
    }`;
    const res = await sendNotification({
      tipo: TipoNotificacion.SMS,
      destino: telefono,
      mensaje,
    } as any);
    resultados.push(`SMS: ${res}`);
  }

  // --- WhatsApp (si hay teléfono)
  if (telefono) {
    console.log(`Enviando WhatsApp a ${telefono}...`);
    const res = await sendNotification({
      tipo: TipoNotificacion.WHATSAPP,
      destino: telefono,
      templateId: NotificationTemplates.COBRO.WHATSAPP_TEMPLATE_ID,
      // Si usas Twilio Content Variables con índices '1','2', etc.
      templateData: {
        '1': String(nombre),
        '2': String(deudaStr),
        // agrega más si tu template lo requiere, p.ej. '3': enlace
        ...(enlace ? { '3': enlace } : {}),
      },
    } as any);
    resultados.push(`WhatsApp: ${res}`);
  }

  // --- Correo (si hay email)
  if (correo) {
    console.log(`Enviando correo a ${correo}...`);
    const res = await sendNotification({
      tipo: TipoNotificacion.CORREO,
      destino: correo,
      templateId: NotificationTemplates.COBRO.EMAIL_TEMPLATE_ID,
      templateData: {
        nombre,
        deuda: deudaStr,
        ...(enlace ? { enlacePago: enlace } : {}),
      },
    } as any);
    resultados.push(`Correo: ${res}`);
  }

  return resultados;
};

/**
 * 👉 Envío masivo: itera por la lista de deudores y usa el envío unitario.
 *    Maneja errores por cada deudor sin detener todo el proceso.
 */
export const enviarNotificacionCobroMasivo = async (
  deudores: Deudor[],
  opts?: CobroOptions
) => {
  console.log("Iniciando notificación MASIVA de COBRO...");
  const resultadosGlobal: { id?: string; resultado: string[] }[] = [];

  for (const deudor of deudores) {
    try {
      const resultado = await enviarNotificacionCobro(deudor, opts);
      resultadosGlobal.push({ id: (deudor as any).id, resultado });
    } catch (error) {
      console.error(`Error al notificar COBRO a ${ (deudor as any).id }:`, error);
      resultadosGlobal.push({
        id: (deudor as any).id,
        resultado: [`❌ Error al notificar: ${error}`],
      });
    }
  }

  return resultadosGlobal;
};
