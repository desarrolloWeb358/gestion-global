import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { getOrCreateConversation, appendMessage } from "./conversationService";

interface TemplateParameter {
  parameterName: string;
  value: string;
}

// Normaliza teléfono: quita +, espacios y guiones → deja solo dígitos
function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

// Retorna el wamid asignado por Meta ("wamid.xxx...") o "" si no viene
async function callMetaTemplateApi(
  phoneNumberId: string,
  token: string,
  to: string,
  templateName: string,
  parameters: TemplateParameter[]
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

  const body: Record<string, unknown> = {
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

export const sendMetaTemplate = onCall(
  { region: "us-central1", invoker: "public" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    const { numberId, to, templateId, parameters, clienteId, deudorId, deudorNombre } = (
      request.data ?? {}
    ) as {
      numberId?: string;
      to?: string;           // número destino en formato internacional, ej: "573001234567"
      templateId?: string;
      parameters?: TemplateParameter[];
      clienteId?: string;
      deudorId?: string;
      deudorNombre?: string;
    };

    if (!numberId || !to?.trim() || !templateId) {
      throw new HttpsError(
        "invalid-argument",
        "Se requieren numberId, to y templateId."
      );
    }

    const userAddress = normalizePhone(to);
    if (userAddress.length < 10) {
      throw new HttpsError("invalid-argument", "Número de teléfono inválido.");
    }

    const db = getFirestore();

    const numberSnap = await db.doc(`numbers/${numberId}`).get();
    if (!numberSnap.exists) {
      throw new HttpsError("not-found", "Número no encontrado.");
    }
    const numberData = numberSnap.data() as {
      phoneNumberId: string;
      metaToken: string;
    };

    const templateSnap = await db
      .doc(`numbers/${numberId}/templates/${templateId}`)
      .get();
    if (!templateSnap.exists) {
      throw new HttpsError("not-found", "Plantilla no encontrada.");
    }
    const templateData = templateSnap.data() as {
      providerTemplateName: string;
      bodyText?: string;
      displayName?: string;
    };

    // Crea la conversación si no existe (nuevo contacto)
    const conv = await getOrCreateConversation(numberId, userAddress, {
      clienteId,
      deudorId,
      deudorNombre,
    });

    const params = parameters ?? [];

    const wamid = await callMetaTemplateApi(
      numberData.phoneNumberId,
      numberData.metaToken,
      userAddress,
      templateData.providerTemplateName,
      params
    );

    // Construir texto legible: reemplaza {{variable}} con los valores enviados
    let messageText = templateData.bodyText ?? `[Plantilla: ${templateData.displayName ?? templateData.providerTemplateName}]`;
    for (const p of params) {
      messageText = messageText.replace(new RegExp(`\\{\\{${p.parameterName}\\}\\}`, "g"), p.value);
    }

    await appendMessage({
      numberId,
      conversationId: conv.id,
      message: {
        role: "assistant",
        text: messageText,
        source: "AGENT",
        timestampMs: Date.now(),
        providerMessageId: wamid || undefined,
        deliveryStatus: "pending",
      },
    });

    logger.info("Template enviado por Meta", {
      numberId,
      conversationId: conv.id,
      templateId,
      agentId: request.auth.uid,
      to: userAddress,
    });

    // Devuelve conversationId para que el frontend pueda navegar a la conversación
    return { ok: true, conversationId: conv.id };
  }
);
