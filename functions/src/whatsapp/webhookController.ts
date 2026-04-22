import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { getOrCreateConversation, appendMessage } from "./conversationService";

export const META_VERIFY_TOKEN = defineSecret("META_VERIFY_TOKEN");

// Quita el código de país colombiano (57) para comparar con el array telefonos del deudor
function toLocalPhone(phone: string): string {
  if (phone.startsWith("57") && phone.length === 12) return phone.slice(2);
  return phone;
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

    if (!messages.length || !phoneNumberId) {
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

    const numberId = numbersSnap.docs[0].id;

    for (const msg of messages as any[]) {
      const from: string  = String(msg?.from || "");
      const wamid: string = String(msg?.id   || "");

      const text: string =
        msg?.text?.body ||
        msg?.button?.text ||
        msg?.interactive?.list_reply?.title ||
        "";

      if (!from || !text) {
        logger.warn("Mensaje ignorado (sin from o sin texto)", { from, wamid });
        continue;
      }

      try {
        // Buscar deudor por teléfono para auto-vincular la conversación
        const localPhone = toLocalPhone(from);
        const deudorMeta = await findDeudorByPhone(localPhone);

        await getOrCreateConversation(numberId, from, deudorMeta ?? undefined);
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

        logger.info("Mensaje entrante guardado", {
          from,
          wamid,
          numberId,
          deudorVinculado: !!deudorMeta,
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg === "DUPLICATE_MESSAGE") {
          logger.info("Mensaje duplicado ignorado", { wamid });
          continue;
        }
        logger.error("Error procesando mensaje entrante", err);
      }
    }

    res.status(200).json({ ok: true });
  }
);
