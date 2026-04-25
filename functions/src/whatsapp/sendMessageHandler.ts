import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { appendMessage } from "./conversationService";

// Envío directo a Meta Graph API v22.0
// Mismo patrón que MetaMessagingProvider de omnix, simplificado a función
// Retorna el wamid asignado por Meta o "" si no viene
async function sendMetaText(
  phoneNumberId: string,
  token: string,
  to: string,
  text: string
): Promise<string> {
  const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      text: { body: text },
    }),
  });

  if (!resp.ok) {
    const error = await resp.json().catch(() => null);
    throw new Error(
      `META_SEND_FAILED status=${resp.status} body=${JSON.stringify(error)}`
    );
  }

  const data = await resp.json().catch(() => ({}));
  return (data as any)?.messages?.[0]?.id ?? "";
}

// onCall: llamado desde el frontend cuando el asesor escribe un mensaje
export const sendWhatsAppMessage = onCall(
  { region: "us-central1", invoker: "public" }, // invoker:"public" requerido para llamadas desde el browser (Cloud Run v2)
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    const { numberId, conversationId, text } = (request.data ?? {}) as {
      numberId?: string;
      conversationId?: string;
      text?: string;
    };

    if (!numberId || !conversationId || !text?.trim()) {
      throw new HttpsError(
        "invalid-argument",
        "Se requieren numberId, conversationId y text."
      );
    }

    const db = getFirestore();

    // Cargar el número para obtener phoneNumberId y metaToken
    const numberSnap = await db.doc(`numbers/${numberId}`).get();
    if (!numberSnap.exists) {
      throw new HttpsError("not-found", "Número no encontrado.");
    }
    const numberData = numberSnap.data() as {
      phoneNumberId: string;
      metaToken: string;
    };

    // Cargar la conversación para obtener el número destino (userAddress)
    const convSnap = await db
      .doc(`numbers/${numberId}/conversations/${conversationId}`)
      .get();
    if (!convSnap.exists) {
      throw new HttpsError("not-found", "Conversación no encontrada.");
    }
    const { userAddress } = convSnap.data() as { userAddress: string };

    // Enviar mensaje por Meta Cloud API
    const wamid = await sendMetaText(
      numberData.phoneNumberId,
      numberData.metaToken,
      userAddress,
      text.trim()
    );

    // Guardar en Firestore como mensaje del asesor (source: AGENT)
    await appendMessage({
      numberId,
      conversationId,
      message: {
        role: "assistant",
        text: text.trim(),
        source: "AGENT",
        timestampMs: Date.now(),
        providerMessageId: wamid || undefined,
        deliveryStatus: "pending",
      },
    });

    logger.info("Mensaje AGENT enviado por Meta", {
      numberId,
      conversationId,
      agentId: request.auth.uid,
      to: userAddress,
    });

    return { ok: true };
  }
);
