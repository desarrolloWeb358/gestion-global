import { Inmueble } from "../models/inmueble.model";
import { sendNotification } from "@/shared/services/sendNotification";
import { TipoNotificacion } from "@/shared/constants/notificacionTipos";

export const enviarNotificacionCobro = async (inmueble: Inmueble) => {
  console.log(`Enviando notificación de cobro para el inmueble ${inmueble.id}...`);
  const resultados: string[] = [];

  const nombre = inmueble.nombreResponsable || "Usuario";
  const telefono = inmueble.telefonoResponsable || inmueble.telefonos?.[0];
  const correo = inmueble.correoResponsable || inmueble.correos?.[0];

  // SMS
  if (telefono) {
    console.log(`Enviando SMS a ${telefono}...`);
    const mensaje = `Hola ${nombre}, le recordamos que tiene una deuda pendiente de $${inmueble.deuda_total}.`;
    const res = await sendNotification({
      tipo: TipoNotificacion.SMS,
      destino: telefono,
      mensaje,
    });
    resultados.push(`SMS: ${res}`);
  }

  // WhatsApp
  if (telefono) {
    console.log(`Enviando WhatsApp a ${telefono}...`);
    const nombreStr = nombre.toString();
    const deudaStr = inmueble.deuda_total.toLocaleString();

    console.log("🚀 Enviando WhatsApp con:", nombreStr, deudaStr);

    const res = await sendNotification({
      tipo: TipoNotificacion.WHATSAPP,
      destino: telefono,
      templateId: "HX8438e2890309f9bd97a6803dca152099", // ← cambia por tu SID real
      templateData: {
        '1': nombreStr,
        '2': deudaStr,
      },
    });
    resultados.push(`WhatsApp: ${res}`);
  }

  // Correo
  if (correo) {
    console.log(`Enviando correo a ${correo}...`);
    const res = await sendNotification({
      tipo: TipoNotificacion.CORREO,
      destino: correo,
      templateId: "d-2ca889256a79400b811dcb7de031c67b", // ← cambia por tu Template ID real
      templateData: {
        nombre,
        deuda: inmueble.deuda_total,
      },
    });
    resultados.push(`Correo: ${res}`);
  }

  return resultados;
};

// ✅ Esta es la función MASIVA
export const enviarNotificacionCobroMasivo = async (inmuebles: Inmueble[]) => {
  console.log("Iniciando notificación masiva de cobro...");
  const resultadosGlobal: { id?: string; resultado: string[] }[] = [];

  for (const inmueble of inmuebles) {
    try {
      const resultado = await enviarNotificacionCobro(inmueble);
      resultadosGlobal.push({ id: inmueble.id, resultado });
    } catch (error) {
      console.error(`Error al notificar al inmueble ${inmueble.id}:`, error);
      resultadosGlobal.push({
        id: inmueble.id,
        resultado: [`❌ Error al notificar: ${error}`],
      });
    }
  }

  return resultadosGlobal;
};
