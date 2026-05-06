import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { getOrCreateConversation, appendMessage } from "./conversationService";

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 600;

const TIPS_JURIDICO = new Set([
  "Demanda",
  "Demanda/Acuerdo",
  "Demanda/Terminado",
  "Demanda/Insolvencia",
]);

interface BulkItem {
  deudorId: string;
  deudorNombre: string;
  tipificacion?: string;
  phone: string;
  parameters: Array<{ parameterName: string; value: string }>;
  messageText: string;
}

interface BulkResult {
  nombre: string;
  phone: string;
  status: "ok" | "error" | "no_phone";
  error?: string;
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function callMetaTemplateApi(
  phoneNumberId: string,
  token: string,
  to: string,
  templateName: string,
  parameters: Array<{ parameterName: string; value: string }>
): Promise<string> {
  const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;

  const components =
    parameters.length > 0
      ? [
          {
            type: "body",
            parameters: parameters.map((p) => ({
              type: "text",
              parameter_name: p.parameterName,
              text: p.value,
            })),
          },
        ]
      : [];

  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: "es_CO" },
      ...(components.length > 0 && { components }),
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const error = await resp.json().catch(() => null);
    throw new Error(
      `META_TEMPLATE_SEND_FAILED status=${resp.status} body=${JSON.stringify(error)}`
    );
  }

  const data = await resp.json().catch(() => ({}));
  return (data as any)?.messages?.[0]?.id ?? "";
}

export const processBulkSendJob = onDocumentCreated(
  {
    document: "bulkSendJobs/{jobId}",
    region: "us-central1",
    timeoutSeconds: 540,
  },
  async (event) => {
    const jobId = event.params.jobId;
    const db = getFirestore();
    const jobRef = db.doc(`bulkSendJobs/${jobId}`);

    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) return;

    const job = jobSnap.data() as {
      status: string;
      numberId: string;
      templateId: string;
      clienteId: string;
      agentId: string;
      items: BulkItem[];
      noPhone: Array<{ nombre: string }>;
    };

    // Evitar reprocesar si ya fue tomado (retry de Cloud Functions)
    if (job.status !== "pending") {
      logger.info("Job ignorado, ya fue procesado", { jobId, status: job.status });
      return;
    }

    await jobRef.update({ status: "processing", updatedAt: Timestamp.now() });

    // Cargar credenciales del número
    const numberSnap = await db.doc(`numbers/${job.numberId}`).get();
    if (!numberSnap.exists) {
      await jobRef.update({
        status: "error",
        error: "Número de WhatsApp no encontrado",
        updatedAt: Timestamp.now(),
      });
      return;
    }
    const { phoneNumberId, metaToken } = numberSnap.data() as {
      phoneNumberId: string;
      metaToken: string;
    };

    // Cargar nombre de la plantilla en Meta
    const templateSnap = await db
      .doc(`numbers/${job.numberId}/templates/${job.templateId}`)
      .get();
    if (!templateSnap.exists) {
      await jobRef.update({
        status: "error",
        error: "Plantilla no encontrada",
        updatedAt: Timestamp.now(),
      });
      return;
    }
    const { providerTemplateName } = templateSnap.data() as {
      providerTemplateName: string;
    };

    // Arrancar con los deudores sin teléfono ya marcados
    const allResults: BulkResult[] = (job.noPhone ?? []).map((n) => ({
      nombre: n.nombre,
      phone: "",
      status: "no_phone",
    }));

    const items = job.items ?? [];

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (item) => {
          try {
            const wamid = await callMetaTemplateApi(
              phoneNumberId,
              metaToken,
              item.phone,
              providerTemplateName,
              item.parameters
            );

            const conv = await getOrCreateConversation(job.numberId, item.phone, {
              clienteId: job.clienteId,
              deudorId: item.deudorId,
              deudorNombre: item.deudorNombre,
            });

            await appendMessage({
              numberId: job.numberId,
              conversationId: conv.id,
              message: {
                role: "assistant",
                text: item.messageText,
                source: "AGENT",
                timestampMs: Date.now(),
                providerMessageId: wamid || undefined,
                deliveryStatus: "pending",
              },
            });

            const esJuridico = TIPS_JURIDICO.has(item.tipificacion ?? "");
            const seguimientoCol = esJuridico ? "seguimientoJuridico" : "seguimiento";
            await db
              .collection(
                `clientes/${job.clienteId}/deudores/${item.deudorId}/${seguimientoCol}`
              )
              .add({
                fecha: Timestamp.now(),
                fechaCreacion: Timestamp.now(),
                clienteUID: job.clienteId,
                ejecutivoUID: job.agentId,
                tipoSeguimiento: "whatsapp",
                descripcion: `Se envió mensaje masivo:\n${item.messageText}\n\nNúmero: ${item.phone}`,
              });

            allResults.push({ nombre: item.deudorNombre, phone: item.phone, status: "ok" });
          } catch (err) {
            allResults.push({
              nombre: item.deudorNombre,
              phone: item.phone,
              status: "error",
              error: err instanceof Error ? err.message : "Error desconocido",
            });
          }
        })
      );

      // Actualizar progreso después de cada lote
      await jobRef.update({
        results: allResults,
        progress: {
          current: Math.min(i + BATCH_SIZE, items.length),
          total: items.length,
        },
        updatedAt: Timestamp.now(),
      });

      if (i + BATCH_SIZE < items.length) await delay(BATCH_DELAY_MS);
    }

    const sent   = allResults.filter((r) => r.status === "ok").length;
    const failed = allResults.filter((r) => r.status === "error").length;

    await jobRef.update({
      status: "done",
      results: allResults,
      progress: { current: items.length, total: items.length },
      completedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    logger.info("Bulk send job completado", { jobId, sent, failed, total: items.length });
  }
);
