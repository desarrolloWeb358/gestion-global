import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {
  GMAIL_USER,
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  sendEmail,
} from "../notificaciones/sendEmail";

// Tipos válidos de valores agregados que reciben recordatorio
const TIPOS_VALIDOS = new Set(["Derechos de peticion", "Tutela", "Contratos"]);

const MS_HORA = 60 * 60 * 1000;
// Ventana fija: 1 día antes, el día que vence, y 1 día después
const VENTANA_ANTES_MS = 48 * MS_HORA;  // hasta 48h adelante cubre "1 día antes"
const VENTANA_DESPUES_MS = 24 * MS_HORA; // hasta 24h atrás cubre "1 día después"

// Corre todos los días a las 7:00 AM hora Colombia
export const recordatorioPlazosLegales = onSchedule(
  {
    schedule: "0 12 * * *", // 7am Colombia = 12pm UTC
    timeZone: "America/Bogota",
    secrets: [GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN],
  },
  async () => {
    const db = admin.firestore();
    const ahora = new Date();

    logger.info("[recordatorioPlazosLegales] Iniciando revisión de plazos", {
      ahora: ahora.toISOString(),
    });

    // Ventana exacta: ayer a esta hora → pasado mañana a esta hora
    const hace1Dia = new Date(ahora.getTime() - VENTANA_DESPUES_MS);
    const en2Dias = new Date(ahora.getTime() + VENTANA_ANTES_MS);

    const snap = await db
      .collectionGroup("valoresAgregados")
      .where("completado", "==", false)
      .where("fechaLimite", ">=", admin.firestore.Timestamp.fromDate(hace1Dia))
      .where("fechaLimite", "<=", admin.firestore.Timestamp.fromDate(en2Dias))
      .get();

    logger.info(`[recordatorioPlazosLegales] Encontrados ${snap.size} valores para evaluar`);

    if (snap.empty) return;

    for (const docSnap of snap.docs) {
      try {
        const data = docSnap.data() as any;
        const ref = docSnap.ref;

        const tipo: string = data.tipo || "";

        if (!TIPOS_VALIDOS.has(tipo)) {
          logger.info(`[recordatorioPlazosLegales] Tipo "${tipo}" no configurado, omitiendo`);
          continue;
        }

        const fechaLimiteDate: Date = (data.fechaLimite as admin.firestore.Timestamp).toDate();
        const diferenciaMs = fechaLimiteDate.getTime() - ahora.getTime();

        // Ruta: clientes/{clienteId}/valoresAgregados/{valorId}
        const pathParts = ref.path.split("/");
        const clienteId = pathParts[1];
        const valorId = pathParts[3];

        const clienteSnap = await db.collection("clientes").doc(clienteId).get();
        if (!clienteSnap.exists) continue;

        const clienteData = clienteSnap.data() as any;
        const abogadoId: string | undefined = clienteData?.abogadoId;
        const nombreCliente: string = clienteData?.nombre || clienteId;

        if (!abogadoId) {
          logger.warn(`[recordatorioPlazosLegales] Cliente ${clienteId} sin abogadoId, omitiendo`);
          continue;
        }

        const abogadoSnap = await db.collection("usuarios").doc(abogadoId).get();
        if (!abogadoSnap.exists) continue;

        const abogadoData = abogadoSnap.data() as any;
        const correoAbogado: string | undefined = abogadoData?.email;
        const nombreAbogado: string = abogadoData?.nombre || "Abogado";

        if (!correoAbogado) {
          logger.warn(`[recordatorioPlazosLegales] Abogado ${abogadoId} sin correo, omitiendo`);
          continue;
        }

        const diferenciaHoras = Math.round(diferenciaMs / (1000 * 60 * 60));
        const titulo: string = data.titulo || "Sin título";

        let urgencia: string;
        let colorUrgencia: string;

        if (diferenciaMs < 0) {
          urgencia = `⛔ VENCIDO hace ${Math.abs(diferenciaHoras)} horas`;
          colorUrgencia = "#dc2626";
        } else if (diferenciaHoras <= 24) {
          urgencia = `🚨 VENCE HOY / en ${diferenciaHoras} horas`;
          colorUrgencia = "#ea580c";
        } else {
          urgencia = `⚠️ VENCE MAÑANA / en ${diferenciaHoras} horas`;
          colorUrgencia = "#d97706";
        }

        const fechaLimiteStr = fechaLimiteDate.toLocaleDateString("es-CO", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        const subject = `[Recordatorio] Plazo legal: ${tipo} - ${nombreCliente}`;

        const cuerpoHtml = `
          <p style="font-size:16px;font-weight:bold;color:${colorUrgencia};">${urgencia}</p>
          <p>Hay un valor agregado pendiente de resolución:</p>
          <table style="border-collapse:collapse;width:100%;font-size:14px;">
            <tr><td style="padding:6px;font-weight:bold;color:#374151;">Cliente:</td><td style="padding:6px;">${nombreCliente}</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:6px;font-weight:bold;color:#374151;">Tipo:</td><td style="padding:6px;">${tipo}</td></tr>
            <tr><td style="padding:6px;font-weight:bold;color:#374151;">Título:</td><td style="padding:6px;">${titulo}</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:6px;font-weight:bold;color:#374151;">Fecha límite:</td><td style="padding:6px;color:${colorUrgencia};font-weight:bold;">${fechaLimiteStr}</td></tr>
          </table>
          <p style="margin-top:16px;">Ingresa a la plataforma para revisar y marcar como completado cuando esté resuelto.</p>
        `;

        const htmlEmail = `
          <!doctype html>
          <html lang="es">
          <head><meta charset="utf-8"/><title>${subject}</title></head>
          <body style="margin:0;padding:0;font-family:system-ui,sans-serif;background:#f3f4f6;">
            <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
              <tr><td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 10px 15px rgba(0,0,0,0.05);">
                  <tr><td style="background:#111827;color:#f9fafb;padding:16px 24px;">
                    <h1 style="margin:0;font-size:20px;">Gestión Global</h1>
                    <p style="margin:4px 0 0;font-size:13px;opacity:.8;">Plataforma de gestión de cartera</p>
                  </td></tr>
                  <tr><td style="padding:24px;">
                    <p style="margin-top:0;">Hola <strong>${nombreAbogado}</strong>,</p>
                    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Recordatorio de plazo legal</h2>
                    <div style="font-size:14px;color:#374151;line-height:1.5;">${cuerpoHtml}</div>
                    <p style="margin-top:24px;font-size:12px;color:#6b7280;">
                      Este es un recordatorio automático. Si ya resolviste este caso, márcalo como completado en la plataforma para dejar de recibir recordatorios.
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

        // 1) Alerta en la app (desactivada por ahora)
        // const ruta = `/clientes/${clienteId}/valores-agregados/${valorId}`;
        // await db.collection(`usuarios/${abogadoId}/notificaciones`).add({
        //   descripcion: `[Recordatorio] ${urgencia} — ${tipo}: ${titulo} (${nombreCliente})`,
        //   ruta,
        //   modulo: "valor_agregado",
        //   visto: false,
        //   fecha: admin.firestore.FieldValue.serverTimestamp(),
        // });

        // 2) Correo
        await sendEmail({
          to: correoAbogado,
          subject,
          text: `Recordatorio: ${urgencia} — ${tipo}: ${titulo} (${nombreCliente}). Fecha límite: ${fechaLimiteStr}`,
          html: htmlEmail,
        });

        logger.info(`[recordatorioPlazosLegales] Notificado abogado ${abogadoId} para valor ${valorId}`);
      } catch (err) {
        logger.error("[recordatorioPlazosLegales] Error procesando valor:", err);
      }
    }

    logger.info("[recordatorioPlazosLegales] Revisión completada");
  }
);
