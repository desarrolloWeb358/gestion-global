import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { appendMessage, type MediaType } from "./conversationService";

const META_BASE = "https://graph.facebook.com/v22.0";

// ── sendMetaText ──────────────────────────────────────────────────────
async function sendMetaText(
  phoneNumberId: string,
  token: string,
  to: string,
  text: string
): Promise<string> {
  const resp = await fetch(`${META_BASE}/${phoneNumberId}/messages`, {
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
    throw new Error(`META_SEND_FAILED status=${resp.status} body=${JSON.stringify(error)}`);
  }

  const data = await resp.json().catch(() => ({}));
  return (data as any)?.messages?.[0]?.id ?? "";
}

// ── sendMetaMedia ─────────────────────────────────────────────────────
async function sendMetaMedia(
  phoneNumberId: string,
  token: string,
  to: string,
  params: { mediaUrl: string; mediaType: MediaType; caption?: string; filename?: string }
): Promise<string> {
  const { mediaUrl, mediaType, caption, filename } = params;

  const mediaBody =
    mediaType === "image"
      ? { image:    { link: mediaUrl, caption: caption ?? "" } }
      : mediaType === "video"
      ? { video:    { link: mediaUrl, caption: caption ?? "" } }
      : mediaType === "audio"
      ? { audio:    { link: mediaUrl } }
      : { document: { link: mediaUrl, caption: caption ?? "", filename: filename ?? "archivo" } };

  const resp = await fetch(`${META_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: mediaType,
      ...mediaBody,
    }),
  });

  if (!resp.ok) {
    const error = await resp.json().catch(() => null);
    throw new Error(`META_SEND_MEDIA_FAILED status=${resp.status} body=${JSON.stringify(error)}`);
  }

  const data = await resp.json().catch(() => ({}));
  return (data as any)?.messages?.[0]?.id ?? "";
}

// ── onCall: sendWhatsAppMessage ───────────────────────────────────────
// Acepta texto plano O media (imagen, video, documento, audio)
export const sendWhatsAppMessage = onCall(
  { region: "us-central1", invoker: "public" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    const data = (request.data ?? {}) as {
      numberId?: string;
      conversationId?: string;
      text?: string;
      mediaUrl?: string;
      mediaType?: string;
      mediaCaption?: string;
      mediaFilename?: string;
    };

    const { numberId, conversationId } = data;
    const text        = data.text?.trim() ?? "";
    const mediaUrl    = data.mediaUrl ?? "";
    const mediaType   = data.mediaType as MediaType | undefined;
    const mediaCaption  = data.mediaCaption ?? "";
    const mediaFilename = data.mediaFilename ?? "";

    const hasText  = text.length > 0;
    const hasMedia = mediaUrl.length > 0 && !!mediaType;

    if (!numberId || !conversationId || (!hasText && !hasMedia)) {
      throw new HttpsError("invalid-argument", "Se requieren numberId, conversationId y text o mediaUrl+mediaType.");
    }

    if (hasMedia && !["image", "video", "document", "audio"].includes(mediaType!)) {
      throw new HttpsError("invalid-argument", "mediaType debe ser image, video, document o audio.");
    }

    const db = getFirestore();

    const [numberSnap, convSnap] = await Promise.all([
      db.doc(`numbers/${numberId}`).get(),
      db.doc(`numbers/${numberId}/conversations/${conversationId}`).get(),
    ]);

    if (!numberSnap.exists) throw new HttpsError("not-found", "Número no encontrado.");
    if (!convSnap.exists)   throw new HttpsError("not-found", "Conversación no encontrada.");

    const { phoneNumberId, metaToken } = numberSnap.data() as { phoneNumberId: string; metaToken: string };
    const { userAddress } = convSnap.data() as { userAddress: string };

    let wamid = "";

    if (hasMedia) {
      wamid = await sendMetaMedia(phoneNumberId, metaToken, userAddress, {
        mediaUrl,
        mediaType: mediaType!,
        caption: mediaCaption || undefined,
        filename: mediaFilename || undefined,
      });

      await appendMessage({
        numberId,
        conversationId,
        message: {
          role: "assistant",
          text: mediaCaption ?? "",
          source: "AGENT",
          timestampMs: Date.now(),
          providerMessageId: wamid || undefined,
          deliveryStatus: "pending",
          mediaUrl,
          mediaType,
          mediaFilename: mediaFilename || undefined,
        },
      });

      logger.info("Media AGENT enviada por Meta", {
        numberId, conversationId, agentId: request.auth.uid, mediaType, to: userAddress,
      });
    } else {
      wamid = await sendMetaText(phoneNumberId, metaToken, userAddress, text);

      await appendMessage({
        numberId,
        conversationId,
        message: {
          role: "assistant",
          text,
          source: "AGENT",
          timestampMs: Date.now(),
          providerMessageId: wamid || undefined,
          deliveryStatus: "pending",
        },
      });

      logger.info("Mensaje AGENT enviado por Meta", {
        numberId, conversationId, agentId: request.auth.uid, to: userAddress,
      });
    }

    return { ok: true };
  }
);
