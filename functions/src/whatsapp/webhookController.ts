import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";
import { getOrCreateConversation, appendMessage, updateMessageDeliveryStatus, type MediaType } from "./conversationService";

export const META_VERIFY_TOKEN = defineSecret("META_VERIFY_TOKEN");

const META_BASE = "https://graph.facebook.com/v22.0";

// Quita el código de país colombiano (57) para comparar con el array telefonos del deudor
function toLocalPhone(phone: string): string {
  if (phone.startsWith("57") && phone.length === 12) return phone.slice(2);
  return phone;
}

// Determina el MediaType a partir del tipo de mensaje Meta
function msgTypeToMediaType(msgType: string): MediaType | null {
  if (msgType === "image")    return "image";
  if (msgType === "video")    return "video";
  if (msgType === "document") return "document";
  if (msgType === "audio" || msgType === "voice") return "audio";
  return null;
}

// Extensión de archivo por mime type
function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "video/mp4": "mp4", "video/3gpp": "3gp",
    "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac",
    "application/pdf": "pdf",
  };
  return map[mime] ?? mime.split("/")[1] ?? "bin";
}

// Descarga un archivo de media de Meta y lo sube a Firebase Storage
// Retorna la URL pública permanente
async function downloadAndStoreMedia(params: {
  mediaId: string;
  token: string;
  numberId: string;
  conversationId: string;
  wamid: string;
  mimeType: string;
  filename?: string;
}): Promise<string> {
  const { mediaId, token, numberId, conversationId, wamid, mimeType, filename } = params;

  // 1) Obtener URL temporal de Meta
  const metaResp = await fetch(`${META_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaResp.ok) throw new Error(`META_MEDIA_URL_FAILED status=${metaResp.status}`);
  const metaJson = await metaResp.json() as { url?: string };
  const tempUrl = metaJson.url;
  if (!tempUrl) throw new Error("META_MEDIA_URL_EMPTY");

  // 2) Descargar el archivo
  const fileResp = await fetch(tempUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!fileResp.ok) throw new Error(`META_MEDIA_DOWNLOAD_FAILED status=${fileResp.status}`);
  const buffer = Buffer.from(await fileResp.arrayBuffer());

  // 3) Subir a Firebase Storage
  const ext = filename ? filename.split(".").pop() ?? mimeToExt(mimeType) : mimeToExt(mimeType);
  const storageName = filename ?? `${wamid}.${ext}`;
  const storagePath = `media/incoming/${numberId}/${conversationId}/${storageName}`;

  const bucket = getStorage().bucket();
  const file = bucket.file(storagePath);
  await file.save(buffer, {
    metadata: { contentType: mimeType },
    resumable: false,
  });

  // 4) Hacer el archivo públicamente accesible y obtener URL
  await file.makePublic();
  return file.publicUrl();
}

// Busca el deudor cuyo array telefonos contiene el número local
async function findDeudorByPhone(
  localPhone: string
): Promise<{ clienteId: string; deudorId: string; deudorNombre: string } | null> {
  try {
    const snap = await getFirestore()
      .collectionGroup("deudores")
      .where("telefonos", "array-contains", localPhone)
      .limit(1)
      .get();

    if (snap.empty) return null;

    const doc = snap.docs[0];
    const parts = doc.ref.path.split("/"); // clientes/{clienteId}/deudores/{deudorId}
    return {
      clienteId: parts[1],
      deudorId: parts[3],
      deudorNombre: (doc.data().nombre as string) ?? "",
    };
  } catch (err) {
    logger.warn("Error buscando deudor por teléfono", { localPhone, err });
    return null;
  }
}

export const waWebhook = onRequest(
  { secrets: [META_VERIFY_TOKEN] },
  async (req, res) => {

    // ── GET: verificación del webhook ─────────────────────────────────
    if (req.method === "GET") {
      const mode      = req.query["hub.mode"];
      const token     = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];

      if (mode === "subscribe" && token === META_VERIFY_TOKEN.value()) {
        logger.info("Webhook Meta verificado correctamente");
        res.status(200).send(challenge as string);
      } else {
        logger.warn("Verificación webhook fallida — token no coincide", { mode });
        res.status(403).send("Verification token mismatch");
      }
      return;
    }

    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // ── POST: mensaje entrante ────────────────────────────────────────
    let body: Record<string, unknown> = {};
    try {
      body = typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body as Record<string, unknown>) || {};
    } catch {
      res.status(200).json({ ok: true, ignored: "invalid_json" });
      return;
    }

    const entry         = (body as any)?.entry?.[0];
    const value         = entry?.changes?.[0]?.value;
    const phoneNumberId = String(value?.metadata?.phone_number_id || "");
    const messages: unknown[] = value?.messages ?? [];
    const statuses: unknown[] = value?.statuses ?? [];

    if (!messages.length && !statuses.length || !phoneNumberId) {
      res.status(200).json({ ok: true, noMessages: true });
      return;
    }

    const numbersSnap = await getFirestore()
      .collection("numbers")
      .where("phoneNumberId", "==", phoneNumberId)
      .limit(1)
      .get();

    if (numbersSnap.empty) {
      logger.warn("Número no encontrado en Firestore", { phoneNumberId });
      res.status(200).json({ ok: true, ignored: "number_not_found" });
      return;
    }

    const numberId  = numbersSnap.docs[0].id;
    const metaToken = (numbersSnap.docs[0].data() as any)?.metaToken as string ?? "";

    // ── Mensajes entrantes ────────────────────────────────────────────
    for (const msg of messages as any[]) {
      const from: string    = String(msg?.from || "");
      const wamid: string   = String(msg?.id   || "");
      const msgType: string = String(msg?.type || "text");

      // Texto plano, botones o respuestas interactivas
      const text: string =
        msg?.text?.body ||
        msg?.button?.text ||
        msg?.interactive?.list_reply?.title ||
        msg?.interactive?.button_reply?.title ||
        "";

      const mediaType = msgTypeToMediaType(msgType);
      const isMedia   = mediaType !== null;

      // Ignorar si no hay remitente o si no es texto ni media conocida
      if (!from || (!text && !isMedia)) {
        logger.warn("Mensaje ignorado (sin from, sin texto y sin media)", { from, wamid, msgType });
        continue;
      }

      try {
        const localPhone = toLocalPhone(from);
        const deudorMeta = await findDeudorByPhone(localPhone);

        await getOrCreateConversation(numberId, from, deudorMeta ?? undefined);

        if (isMedia && metaToken) {
          // Extraer datos del objeto de media según el tipo
          const mediaObj: any = msg[msgType] ?? {};
          const mediaId: string   = String(mediaObj?.id        ?? "");
          const mimeType: string  = String(mediaObj?.mime_type ?? "application/octet-stream");
          const caption: string   = String(mediaObj?.caption   ?? "");
          const filename: string  = String(mediaObj?.filename  ?? "");

          if (!mediaId) {
            logger.warn("Media sin ID, ignorando", { from, wamid, msgType });
            continue;
          }

          let mediaUrl = "";
          try {
            mediaUrl = await downloadAndStoreMedia({
              mediaId,
              token: metaToken,
              numberId,
              conversationId: from,
              wamid,
              mimeType,
              filename: filename || undefined,
            });
          } catch (mediaErr) {
            logger.error("Error descargando media entrante", { wamid, mediaErr });
            // Guardamos el mensaje aunque sin URL para no perder el evento
          }

          await appendMessage({
            numberId,
            conversationId: from,
            message: {
              role: "user",
              text: caption,
              source: "PROVIDER",
              timestampMs: Date.now(),
              providerMessageId: wamid,
              mediaUrl:      mediaUrl || undefined,
              mediaType,
              mediaFilename: filename || undefined,
            },
          });

          logger.info("Media entrante guardada", { from, wamid, numberId, mediaType, hasUrl: !!mediaUrl });
        } else {
          await appendMessage({
            numberId,
            conversationId: from,
            message: {
              role: "user",
              text,
              source: "PROVIDER",
              timestampMs: Date.now(),
              providerMessageId: wamid,
            },
          });

          logger.info("Mensaje entrante guardado", { from, wamid, numberId, deudorVinculado: !!deudorMeta });
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg === "DUPLICATE_MESSAGE") {
          logger.info("Mensaje duplicado ignorado", { wamid });
          continue;
        }
        logger.error("Error procesando mensaje entrante", err);
      }
    }

    // ── Status updates de entrega (sent / delivered / read / failed) ──
    // Meta envía esto cuando el mensaje sale de sus servidores, llega al dispositivo
    // o falla. recipient_id es el número destino → coincide con el conversationId.
    const validDeliveryStatuses = new Set(["sent", "delivered", "read", "failed"]);

    for (const statusUpdate of statuses as any[]) {
      const wamid       = String(statusUpdate?.id            || "");
      const status      = String(statusUpdate?.status        || "");
      const recipientId = String(statusUpdate?.recipient_id  || "");

      if (!wamid || !validDeliveryStatuses.has(status) || !recipientId) continue;

      try {
        const errorEntry = statusUpdate?.errors?.[0];
        await updateMessageDeliveryStatus(
          numberId,
          recipientId,
          wamid,
          status as "sent" | "delivered" | "read" | "failed",
          errorEntry ? { code: errorEntry.code, title: errorEntry.title } : undefined
        );
        logger.info("Estado de entrega actualizado", { wamid, status, recipientId, numberId });
      } catch (err) {
        logger.error("Error actualizando estado de entrega", { wamid, err });
      }
    }

    res.status(200).json({ ok: true });
  }
);
