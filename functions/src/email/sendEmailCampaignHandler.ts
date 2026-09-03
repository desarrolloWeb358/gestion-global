import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  GMAIL_USER,
  sendEmail,
} from "../notificaciones/sendEmail";

interface EmailAttachment {
  filename: string;
  contentBase64: string;
  contentType?: string;
}

interface EmailItem {
  to: string;
  subject: string;
  html: string;
  text: string;
  clienteId: string;
  deudorId?: string;
  deudorNombre: string;
  tipificacion?: string;
  attachments?: EmailAttachment[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ATTACHMENT_BASE64_LENGTH = 8_000_000; // ~6MB decoded, well under Gmail's limit
const SEND_DELAY_MS = 300; // ritmo defensivo entre envíos, igual que el job de WhatsApp masivo
const JURIDICAL_TIPS = new Set([
  "Demanda",
  "Demanda/Acuerdo",
  "Demanda terminada",
  "Demanda/Insolvencia",
]);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const sendEmailCampaign = onCall(
  {
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "512MiB",
    secrets: [GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN],
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

    const db = getFirestore();
    const userSnap = await db.collection("usuarios").doc(request.auth.uid).get();
    const roles = Array.isArray(userSnap.data()?.roles) ? userSnap.data()?.roles as string[] : [];
    if (!roles.includes("admin")) {
      throw new HttpsError("permission-denied", "No tienes permiso para enviar campañas de correo.");
    }

    const payload = request.data as {
      items?: unknown;
      mode?: "bulk" | "individual" | "conjunto";
      templateId?: string;
      clienteId?: string;
      conjunto?: string;
      subjectTemplate?: string;
      bodyTemplate?: string;
    };
    const rawItems = payload?.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new HttpsError("invalid-argument", "No hay destinatarios para enviar.");
    }
    if (rawItems.length > 200) {
      throw new HttpsError("invalid-argument", "El máximo por envío es de 200 correos.");
    }

    const items = rawItems as EmailItem[];
    const campaignRef = db.collection("emailCampaigns").doc();
    const results: Array<{ to: string; deudorNombre: string; status: "ok" | "error"; error?: string }> = [];

    await campaignRef.set({
      status: "sending",
      agentId: request.auth.uid,
      mode: payload.mode ?? "bulk",
      templateId: payload.templateId ?? null,
      clienteId: payload.clienteId ?? items[0]?.clienteId ?? null,
      conjunto: payload.conjunto ?? null,
      subject: items[0]?.subject ?? "",
      subjectTemplate: payload.subjectTemplate ?? items[0]?.subject ?? "",
      bodyTemplate: payload.bodyTemplate ?? items[0]?.text ?? "",
      total: items.length,
      createdAt: FieldValue.serverTimestamp(),
    });

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (index > 0) await delay(SEND_DELAY_MS);
      try {
        if (!EMAIL_RE.test(String(item.to ?? "").trim())) throw new Error("Correo inválido");
        if (!item.subject?.trim() || !item.html?.trim()) throw new Error("Asunto o contenido vacío");
        const attachments = Array.isArray(item.attachments) ? item.attachments : [];
        for (const attachment of attachments) {
          if (!attachment?.filename || !attachment?.contentBase64) throw new Error("Adjunto inválido");
          if (attachment.contentBase64.length > MAX_ATTACHMENT_BASE64_LENGTH) throw new Error("El adjunto supera el tamaño máximo permitido");
        }

        await sendEmail({
          to: item.to.trim().toLowerCase(),
          subject: item.subject.trim(),
          text: item.text ?? "",
          html: item.html,
          attachments,
        });

        if (item.clienteId && item.deudorId) {
          const collectionName = JURIDICAL_TIPS.has(item.tipificacion ?? "")
            ? "seguimientoJuridico"
            : "seguimiento";
          await db
            .collection("clientes")
            .doc(item.clienteId)
            .collection("deudores")
            .doc(item.deudorId)
            .collection(collectionName)
            .add({
              usuarioId: request.auth.uid,
              fecha: Timestamp.now(),
              tipoSeguimiento: "correo",
              descripcion: `Se envió el correo \"${item.subject}\" a ${item.to}.`,
            });
        }
        results.push({ to: item.to, deudorNombre: item.deudorNombre, status: "ok" });
        await campaignRef.collection("deliveries").add({
          to: item.to.trim().toLowerCase(),
          deudorId: item.deudorId,
          deudorNombre: item.deudorNombre,
          subject: item.subject,
          text: item.text,
          status: "ok",
          sentAt: FieldValue.serverTimestamp(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        logger.error("[sendEmailCampaign] Error", { to: item.to, message });
        results.push({ to: item.to, deudorNombre: item.deudorNombre, status: "error", error: message });
        await campaignRef.collection("deliveries").add({
          to: item.to ?? "",
          deudorId: item.deudorId ?? null,
          deudorNombre: item.deudorNombre ?? "",
          subject: item.subject ?? "",
          text: item.text ?? "",
          status: "error",
          error: message,
          sentAt: FieldValue.serverTimestamp(),
        });
      }
    }

    const sent = results.filter((result) => result.status === "ok").length;
    await campaignRef.update({
      status: "done",
      sent,
      failed: results.length - sent,
      results,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, campaignId: campaignRef.id, sent, failed: results.length - sent, results };
  }
);

export const getEmailCampaignHistory = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    const db = getFirestore();
    const userSnap = await db.collection("usuarios").doc(request.auth.uid).get();
    const roles = Array.isArray(userSnap.data()?.roles) ? userSnap.data()?.roles as string[] : [];
    if (!roles.includes("admin")) {
      throw new HttpsError("permission-denied", "No tienes permiso para consultar campañas de correo.");
    }

    const snap = await db.collection("emailCampaigns").orderBy("createdAt", "desc").limit(100).get();
    const documents = snap.docs;

    const campaigns = documents
      .map((document) => {
        const data = document.data();
        return {
          id: document.id,
          clienteId: data.clienteId ?? "",
          conjunto: data.conjunto ?? "",
          mode: data.mode ?? "bulk",
          templateId: data.templateId ?? "",
          subject: data.subjectTemplate ?? data.subject ?? "",
          body: data.bodyTemplate ?? "",
          total: data.total ?? 0,
          sent: data.sent ?? 0,
          failed: data.failed ?? 0,
          status: data.status ?? "",
          createdAtMs: data.createdAt?.toMillis?.() ?? 0,
        };
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, 100);

    return { campaigns };
  }
);
