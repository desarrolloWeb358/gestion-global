import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {
  GMAIL_USER,
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  sendEmail,
} from "../notificaciones/sendEmail";
import { buildEmailHtml, destinatarioCliente, obtenerClienteInfo } from "../valoresAgregados/shared";

// Avisa a la administración (correo de acceso del cliente) cuando un acuerdo
// de pago queda EN_FIRME, sin depender de que el navegador del abogado
// termine de ejecutar la llamada (mismo motivo que valoresAgregados/notificaciones.ts).

const LOG_TAG = "notificarAcuerdoEnFirme";
const ESTADO_EN_FIRME = "EN_FIRME";

function formatoMoneda(valor: number): string {
  return valor.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

export const notificarAcuerdoEnFirme = onDocumentUpdated(
  {
    document: "clientes/{clienteId}/deudores/{deudorId}/acuerdos/{acuerdoId}",
    region: "us-central1",
    secrets: [GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN],
  },
  async (event) => {
    const change = event.data;
    if (!change) return;

    const before: any = change.before.data();
    const after: any = change.after.data();

    // Solo la transición real hacia EN_FIRME; no la migración que rellena
    // `estado` por primera vez ni escrituras que no tocan el estado.
    if (before?.estado === after?.estado) return;
    if (after?.estado !== ESTADO_EN_FIRME) return;
    if (before?.estado === undefined) return;

    const { clienteId, deudorId, acuerdoId } = event.params as {
      clienteId: string;
      deudorId: string;
      acuerdoId: string;
    };

    const db = admin.firestore();
    const [info, deudorSnap] = await Promise.all([
      obtenerClienteInfo(db, clienteId),
      db.doc(`clientes/${clienteId}/deudores/${deudorId}`).get(),
    ]);

    const destinatario = destinatarioCliente(clienteId, info);
    if (!destinatario.correo) {
      logger.warn(`[${LOG_TAG}] Cliente ${clienteId} sin correo; no se envía el aviso`);
      return;
    }

    const nombreDeudor = (deudorSnap.exists && (deudorSnap.data() as any)?.nombre) || "el deudor";
    const numero = after.numero || acuerdoId;
    const totalFmt = formatoMoneda(Number(after.totalAcordado ?? 0));

    try {
      await sendEmail({
        to: destinatario.correo,
        remitente: "cartera",
        subject: `Acuerdo de pago en firme: ${nombreDeudor}`,
        text: `Se dejó en firme el acuerdo de pago N.° ${numero} con ${nombreDeudor}, por un total de ${totalFmt}.`,
        html: buildEmailHtml(
          destinatario.nombre,
          "Se dejó en firme un acuerdo de pago",
          `
            <p>Se ha dejado en firme un <strong>acuerdo de pago</strong> en la plataforma.</p>
            <ul>
              <li><strong>Deudor:</strong> ${nombreDeudor}</li>
              <li><strong>N.° de acuerdo:</strong> ${numero}</li>
              <li><strong>Total acordado:</strong> ${totalFmt}</li>
            </ul>
          `
        ),
      });

      logger.info(
        `[${LOG_TAG}] Aviso enviado a ${destinatario.correo} por acuerdo ${acuerdoId} del deudor ${deudorId} (cliente ${clienteId})`
      );
    } catch (err) {
      logger.error(`[${LOG_TAG}] Error enviando correo a ${destinatario.correo}:`, err);
    }
  }
);
