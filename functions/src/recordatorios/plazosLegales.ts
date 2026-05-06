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

const APP_BASE_URL = "https://gestionglobal-9eac8.web.app";

// Colombia = UTC-5 (no cambia por horario de verano)
const COLOMBIA_OFFSET_MS = 5 * 60 * 60 * 1000;

function toColombiaDate(utc: Date): Date {
  return new Date(utc.getTime() - COLOMBIA_OFFSET_MS);
}

function startOfDayColombiaAsUTC(utc: Date): Date {
  const col = toColombiaDate(utc);
  col.setHours(0, 0, 0, 0);
  return new Date(col.getTime() + COLOMBIA_OFFSET_MS);
}

function endOfDayColombiaAsUTC(utc: Date): Date {
  const col = toColombiaDate(utc);
  col.setHours(23, 59, 59, 999);
  return new Date(col.getTime() + COLOMBIA_OFFSET_MS);
}

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

    // Ventana: desde inicio de ayer (hora Colombia) hasta fin de mañana (hora Colombia)
    const ayer = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
    const manana = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);

    const inicioVentana = startOfDayColombiaAsUTC(ayer);
    const finVentana = endOfDayColombiaAsUTC(manana);

    const snap = await db
      .collectionGroup("valoresAgregados")
      .where("completado", "==", false)
      .where("fechaLimite", ">=", admin.firestore.Timestamp.fromDate(inicioVentana))
      .where("fechaLimite", "<=", admin.firestore.Timestamp.fromDate(finVentana))
      .get();

    logger.info(`[recordatorioPlazosLegales] Encontrados ${snap.size} valores en ventana`, {
      inicioVentana: inicioVentana.toISOString(),
      finVentana: finVentana.toISOString(),
    });

    if (snap.empty) return;

    // Días Colombia para comparar por calendario
    const ahoraColombia = toColombiaDate(ahora);
    const ayerColombia = toColombiaDate(ayer);
    const manianaColombia = toColombiaDate(manana);

    function diaKey(d: Date) {
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }
    const hoyKey = diaKey(ahoraColombia);
    const ayerKey = diaKey(ayerColombia);
    const manianaKey = diaKey(manianaColombia);

    for (const docSnap of snap.docs) {
      try {
        const data = docSnap.data() as any;
        const ref = docSnap.ref;

        // Ruta: clientes/{clienteId}/valoresAgregados/{valorId}
        const pathParts = ref.path.split("/");
        const clienteId = pathParts[1];
        const valorId = pathParts[3];

        const tipo: string = data.tipo || "";

        if (!tipo) {
          logger.info(`[recordatorioPlazosLegales] Valor ${valorId} sin tipo definido, omitiendo`);
          continue;
        }

        const fechaLimiteDate: Date = (data.fechaLimite as admin.firestore.Timestamp).toDate();
        const fechaLimiteColombia = toColombiaDate(fechaLimiteDate);
        const limiteKey = diaKey(fechaLimiteColombia);

        let urgencia: string;
        let colorUrgencia: string;

        if (limiteKey === ayerKey) {
          urgencia = "⛔ VENCIDO AYER";
          colorUrgencia = "#dc2626";
        } else if (limiteKey === hoyKey) {
          urgencia = "🚨 VENCE HOY";
          colorUrgencia = "#ea580c";
        } else if (limiteKey === manianaKey) {
          urgencia = "⚠️ VENCE MAÑANA";
          colorUrgencia = "#d97706";
        } else {
          // Fuera de los 3 días — no debería llegar aquí dado el query, pero por seguridad
          continue;
        }

        const clienteSnap = await db.collection("clientes").doc(clienteId).get();
        if (!clienteSnap.exists) continue;

        const clienteData = clienteSnap.data() as any;
        const abogadoId: string | undefined = clienteData?.abogadoId;
        const dependienteAbogadoId: string | undefined = clienteData?.dependienteAbogadoId;
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

        const titulo: string = data.titulo || "Sin título";

        // Fecha límite solo día, sin hora
        const fechaLimiteStr = fechaLimiteDate.toLocaleDateString("es-CO", {
          timeZone: "America/Bogota",
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        const enlace = `${APP_BASE_URL}/clientes/${clienteId}/valores-agregados/${valorId}`;
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
          <p style="margin-top:20px;">
            <a href="${enlace}"
               style="display:inline-block;background:#111827;color:#f9fafb;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;">
              Ver valor agregado →
            </a>
          </p>
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

        // 2) Correo al abogado
        await sendEmail({
          to: correoAbogado,
          subject,
          text: `Recordatorio: ${urgencia} — ${tipo}: ${titulo} (${nombreCliente}). Fecha límite: ${fechaLimiteStr}. Ver en: ${enlace}`,
          html: htmlEmail,
        });

        logger.info(`[recordatorioPlazosLegales] Notificado abogado ${abogadoId} para valor ${valorId}`);

        // 3) Correo al dependiente abogado
        if (dependienteAbogadoId) {
          const depSnap = await db.collection("usuarios").doc(dependienteAbogadoId).get();
          if (depSnap.exists) {
            const depData = depSnap.data() as any;
            const correoDepAbogado: string | undefined = depData?.email;
            const nombreDepAbogado: string = depData?.nombre || "Asistente Jurídico";

            if (correoDepAbogado) {
              const htmlEmailDep = htmlEmail.replace(
                `Hola <strong>${nombreAbogado}</strong>`,
                `Hola <strong>${nombreDepAbogado}</strong>`
              );
              await sendEmail({
                to: correoDepAbogado,
                subject,
                text: `Recordatorio: ${urgencia} — ${tipo}: ${titulo} (${nombreCliente}). Fecha límite: ${fechaLimiteStr}. Ver en: ${enlace}`,
                html: htmlEmailDep,
              });
              logger.info(`[recordatorioPlazosLegales] Notificado dependiente ${dependienteAbogadoId} para valor ${valorId}`);
            } else {
              logger.warn(`[recordatorioPlazosLegales] Dependiente ${dependienteAbogadoId} sin correo, omitiendo`);
            }
          }
        }
      } catch (err) {
        logger.error("[recordatorioPlazosLegales] Error procesando valor:", err);
      }
    }

    logger.info("[recordatorioPlazosLegales] Revisión completada");
  }
);
