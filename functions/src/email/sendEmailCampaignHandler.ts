import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  GMAIL_USER,
  sendEmail,
} from "../notificaciones/sendEmail";
import { coleccionSeguimiento } from "../shared/tipificaciones";
import {
  buildHtml,
  replaceVariables,
  stripImagePlaceholder,
  IMAGE_CID,
  type EmailVars,
} from "./renderEmail";

// Ojo: estos objetos se guardan tal cual en el documento de la campaña y
// `admin.initializeApp()` no usa `ignoreUndefinedProperties`, así que los
// campos ausentes van como `null`. Un `undefined` hace que el set() reviente
// con "Cannot use undefined as a Firestore value" y la callable devuelve 500.
interface EmailAttachment {
  filename: string;
  contentBase64: string;
  contentType?: string | null;
}

/** Imagen que se pinta dentro del cuerpo del correo, no como archivo adjunto. */
interface InlineImage {
  filename: string;
  contentBase64: string;
  contentType: string;
}

/** Un destinatario del envío: a quién y con qué valores se renderiza la plantilla. */
interface EmailRecipient {
  to: string;
  deudorId?: string | null;
  deudorNombre: string;
  tipificacion?: string | null;
  vars: EmailVars;
}

interface SendResult {
  to: string;
  deudorNombre: string;
  status: "ok" | "error";
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 200;
/**
 * Los adjuntos viajan en base64 dentro del documento de la campaña, y un
 * documento de Firestore tope en 1 MB. 600 000 caracteres (~440 KB decodificados)
 * dejan margen de sobra para el Excel de deudores y para el resto del documento.
 */
const MAX_ATTACHMENT_BASE64_LENGTH = 600_000;
const MAX_ATTACHMENTS = 3;
/**
 * La imagen incrustada comparte el mismo documento de 1 MB que los adjuntos y
 * los hasta 200 destinatarios, así que tiene su propio techo, más bajo:
 * 400 000 caracteres (~300 KB decodificados). El frontend ya la redimensiona
 * antes de subirla; este límite es la red de seguridad si eso falla.
 */
const MAX_INLINE_IMAGE_BASE64_LENGTH = 400_000;
const INLINE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const SEND_DELAY_MS = 300; // ritmo defensivo entre envíos, igual que el job de WhatsApp masivo
const PROGRESS_EVERY = 5;  // cada cuántos envíos se refresca el contador en vivo

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deja el correo enviado como gestión del deudor, en la colección que le
 * corresponde a su tipificación.
 *
 * El documento debe tener la misma forma que el que escribe la pantalla de
 * seguimientos (`seguimientoService.ts`) y el envío masivo de WhatsApp:
 * `fechaCreacion` + `clienteUID` + `ejecutivoUID` son los campos por los que
 * consulta el reporte de seguimientos por ejecutivo. Sin ellos el correo se ve
 * en la ficha del deudor pero no existe para el reporte, y el deudor sigue
 * contando como "sin gestionar" mientras no se refresque
 * `fechaUltimoSeguimiento`.
 */
async function registrarSeguimientoCorreo(params: {
  clienteId: string;
  deudorId: string;
  tipificacion?: string | null;
  ejecutivoUID: string;
  descripcion: string;
}): Promise<void> {
  const db = getFirestore();
  const ahora = Timestamp.now();
  const deudorRef = db
    .collection("clientes")
    .doc(params.clienteId)
    .collection("deudores")
    .doc(params.deudorId);

  await deudorRef.collection(coleccionSeguimiento(params.tipificacion)).add({
    fecha: ahora,
    fechaCreacion: ahora,
    clienteUID: params.clienteId,
    ejecutivoUID: params.ejecutivoUID,
    tipoSeguimiento: "correo",
    descripcion: params.descripcion,
    actualizadoEn: ahora,
  });

  // Solo hacia adelante: un envío no puede "envejecer" una gestión posterior
  // que haya quedado registrada mientras corría la campaña.
  const deudorSnap = await deudorRef.get();
  const fechaActual = deudorSnap.data()?.fechaUltimoSeguimiento as Timestamp | undefined;
  if (!fechaActual || ahora.toMillis() > (fechaActual.toMillis?.() ?? 0)) {
    await deudorRef.update({ fechaUltimoSeguimiento: ahora });
  }
}

/** Roles que pueden usar el módulo de correos (espejo de PERMS.Email_Write del frontend). */
const ROLES_CORREO = ["admin", "ejecutivoAdmin", "ejecutivo"];
/** De esos, los que ven todos los conjuntos sin restricción de cartera. */
const ROLES_TODAS_LAS_CARTERAS = ["admin", "ejecutivoAdmin"];

interface Solicitante {
  uid: string;
  roles: string[];
  todasLasCarteras: boolean;
}

async function assertPuedeUsarCorreos(uid: string | undefined): Promise<Solicitante> {
  if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  const db = getFirestore();
  const userSnap = await db.collection("usuarios").doc(uid).get();
  const roles = Array.isArray(userSnap.data()?.roles) ? userSnap.data()?.roles as string[] : [];
  if (!roles.some((rol) => ROLES_CORREO.includes(rol))) {
    throw new HttpsError("permission-denied", "No tienes permiso para gestionar campañas de correo.");
  }
  return {
    uid,
    roles,
    todasLasCarteras: roles.some((rol) => ROLES_TODAS_LAS_CARTERAS.includes(rol)),
  };
}

/**
 * Un `ejecutivo` solo puede enviar (y ver el historial) de los conjuntos que
 * tiene asignados. Sin esto bastaría con cambiar el clienteId de la URL para
 * mandarle correos a la cartera de otro. Se aceptan los tres campos de
 * asignación, para que el alcance coincida con el de la página del cliente:
 * si puede abrir el conjunto, puede escribirle.
 */
async function assertAccesoAlConjunto(solicitante: Solicitante, clienteId: string): Promise<void> {
  if (solicitante.todasLasCarteras) return;
  if (!clienteId) {
    throw new HttpsError("invalid-argument", "Falta el conjunto sobre el que se quiere operar.");
  }
  const clienteSnap = await getFirestore().collection("clientes").doc(clienteId).get();
  if (!clienteSnap.exists) throw new HttpsError("not-found", "El conjunto no existe.");
  const data = clienteSnap.data() ?? {};
  const asignados = [data.ejecutivoPrejuridicoId, data.ejecutivoJuridicoId, data.ejecutivoDependienteId];
  if (!asignados.includes(solicitante.uid)) {
    throw new HttpsError("permission-denied", "Este conjunto no está en tu cartera.");
  }
}

function sanitizeAttachments(raw: unknown): EmailAttachment[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new HttpsError("invalid-argument", "Adjuntos inválidos.");
  if (raw.length > MAX_ATTACHMENTS) {
    throw new HttpsError("invalid-argument", `Máximo ${MAX_ATTACHMENTS} adjuntos por envío.`);
  }
  return raw.map((item) => {
    const attachment = item as Partial<EmailAttachment>;
    const filename = String(attachment?.filename ?? "").trim();
    const contentBase64 = String(attachment?.contentBase64 ?? "");
    if (!filename || !contentBase64) {
      throw new HttpsError("invalid-argument", "Adjunto inválido: falta nombre o contenido.");
    }
    if (contentBase64.length > MAX_ATTACHMENT_BASE64_LENGTH) {
      throw new HttpsError("invalid-argument", `El adjunto "${filename}" supera el tamaño máximo permitido.`);
    }
    return {
      filename,
      contentBase64,
      contentType: attachment?.contentType ? String(attachment.contentType) : null,
    };
  });
}

/**
 * La imagen se valida aparte de los adjuntos: va incrustada en el HTML, no en
 * la lista de archivos, y solo se aceptan tipos que un cliente de correo sepa
 * pintar. Sin la comprobación de tipo, un PDF renombrado saldría como un hueco
 * roto en el correo del deudor.
 */
function sanitizeInlineImage(raw: unknown): InlineImage | null {
  if (raw === undefined || raw === null) return null;
  const image = raw as Partial<InlineImage>;
  const filename = String(image?.filename ?? "").trim();
  const contentBase64 = String(image?.contentBase64 ?? "");
  const contentType = String(image?.contentType ?? "").toLowerCase();

  if (!filename || !contentBase64) {
    throw new HttpsError("invalid-argument", "Imagen inválida: falta nombre o contenido.");
  }
  if (!INLINE_IMAGE_TYPES.includes(contentType)) {
    throw new HttpsError("invalid-argument", "La imagen debe ser PNG, JPG, GIF o WEBP.");
  }
  if (contentBase64.length > MAX_INLINE_IMAGE_BASE64_LENGTH) {
    throw new HttpsError("invalid-argument", "La imagen supera el tamaño máximo permitido.");
  }
  return { filename, contentBase64, contentType };
}

function sanitizeRecipients(raw: unknown): EmailRecipient[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new HttpsError("invalid-argument", "No hay destinatarios para enviar.");
  }
  if (raw.length > MAX_RECIPIENTS) {
    throw new HttpsError("invalid-argument", `El máximo por envío es de ${MAX_RECIPIENTS} correos.`);
  }
  return raw.map((item) => {
    const recipient = item as Partial<EmailRecipient>;
    const to = String(recipient?.to ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(to)) {
      throw new HttpsError("invalid-argument", `Correo inválido en la lista de destinatarios: "${to}".`);
    }
    const rawVars = (recipient?.vars ?? {}) as Record<string, unknown>;
    const vars: EmailVars = {};
    for (const [key, value] of Object.entries(rawVars)) {
      if (value !== undefined && value !== null) vars[key as keyof EmailVars] = String(value);
    }
    return {
      to,
      deudorId: recipient?.deudorId ? String(recipient.deudorId) : null,
      deudorNombre: String(recipient?.deudorNombre ?? ""),
      tipificacion: recipient?.tipificacion ? String(recipient.tipificacion) : null,
      vars,
    };
  });
}

/**
 * Encola la campaña y responde de inmediato.
 *
 * Antes esta función enviaba los correos en línea, pero `httpsCallable` corta a
 * los 70 s en el navegador: en un envío de más de ~40 correos el admin veía
 * "No fue posible enviar los correos" mientras el backend seguía enviando, y al
 * reintentar duplicaba los correos a los deudores. Ahora solo valida y escribe
 * el job; `processEmailCampaign` hace el envío y el frontend sigue el progreso
 * con onSnapshot sobre el documento de la campaña.
 */
export const sendEmailCampaign = onCall(
  { region: "us-central1", timeoutSeconds: 60, memory: "256MiB" },
  async (request) => {
    const solicitante = await assertPuedeUsarCorreos(request.auth?.uid);
    const uid = solicitante.uid;

    const payload = request.data as {
      recipients?: unknown;
      attachments?: unknown;
      inlineImage?: unknown;
      mode?: "bulk" | "individual" | "conjunto";
      templateId?: string;
      clienteId?: string;
      conjunto?: string;
      subjectTemplate?: string;
      bodyTemplate?: string;
    };

    const subjectTemplate = String(payload?.subjectTemplate ?? "").trim();
    const bodyTemplate = String(payload?.bodyTemplate ?? "").trim();
    if (!subjectTemplate || !bodyTemplate) {
      throw new HttpsError("invalid-argument", "El asunto y el contenido no pueden estar vacíos.");
    }

    await assertAccesoAlConjunto(solicitante, String(payload?.clienteId ?? "").trim());

    const recipients = sanitizeRecipients(payload?.recipients);
    const attachments = sanitizeAttachments(payload?.attachments);
    const inlineImage = sanitizeInlineImage(payload?.inlineImage);

    const db = getFirestore();
    const campaignRef = db.collection("emailCampaigns").doc();
    try {
      await campaignRef.set({
        status: "queued",
        agentId: uid,
        mode: payload.mode ?? "bulk",
        templateId: payload.templateId ?? null,
        clienteId: payload.clienteId ?? null,
        conjunto: payload.conjunto ?? null,
        subject: subjectTemplate,
        subjectTemplate,
        bodyTemplate,
        recipients,
        attachments,
        inlineImage,
        // Se deja constancia de qué se adjuntó, para poder responder un reclamo
        // del conjunto sobre el cuadro que recibió.
        attachmentNames: attachments.map((attachment) => attachment.filename),
        total: recipients.length,
        processed: 0,
        sent: 0,
        failed: 0,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      // Sin esto, cualquier fallo al escribir el job sale al frontend como un
      // "INTERNAL" mudo y no queda rastro de la causa en los logs.
      const message = error instanceof Error ? error.message : String(error);
      logger.error("[sendEmailCampaign] No se pudo encolar la campana", {
        uid,
        mode: payload.mode,
        clienteId: payload.clienteId,
        totalDestinatarios: recipients.length,
        message,
      });
      throw new HttpsError("internal", `No fue posible encolar la campana: ${message}`);
    }

    return { ok: true, campaignId: campaignRef.id, total: recipients.length };
  }
);

/**
 * Procesa la campaña encolada. Corre en background, así que no lo limita el
 * timeout del navegador; va publicando el avance en el propio documento.
 */
export const processEmailCampaign = onDocumentCreated(
  {
    document: "emailCampaigns/{campaignId}",
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "512MiB",
    retry: false, // un reintento automático volvería a enviar correos ya enviados
    secrets: [GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN],
  },
  async (event) => {
    const campaignRef = event.data?.ref;
    if (!campaignRef) return;
    const db = getFirestore();

    // Reclamamos el job en una transacción: si el trigger se dispara dos veces,
    // solo la primera pasa de "queued" a "sending".
    const claimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(campaignRef);
      if (!snap.exists || snap.data()?.status !== "queued") return null;
      tx.update(campaignRef, { status: "sending", startedAt: FieldValue.serverTimestamp() });
      return snap.data();
    });
    if (!claimed) return;

    const recipients = (claimed.recipients ?? []) as EmailRecipient[];
    const attachments = (claimed.attachments ?? []) as EmailAttachment[];
    const inlineImage = (claimed.inlineImage ?? null) as InlineImage | null;
    const subjectTemplate = String(claimed.subjectTemplate ?? "");
    const bodyTemplate = String(claimed.bodyTemplate ?? "");
    const agentId = String(claimed.agentId ?? "");
    // sendEmail (nodemailer) espera `contentType?: string`; en el documento va como null.
    // Se tipa explícito: sin esto TypeScript infiere el tipo del map (sin `cid`)
    // y el push de la imagen incrustada no compila.
    const mailAttachments: {
      filename: string;
      contentBase64: string;
      contentType?: string;
      cid?: string;
    }[] = attachments.map((attachment) => ({
      filename: attachment.filename,
      contentBase64: attachment.contentBase64,
      contentType: attachment.contentType ?? undefined,
    }));
    // La imagen incrustada viaja como un adjunto más, pero con cid: eso es lo
    // que hace que el cliente de correo la pinte en el cuerpo en vez de
    // listarla junto al Excel.
    if (inlineImage) {
      mailAttachments.push({
        filename: inlineImage.filename,
        contentBase64: inlineImage.contentBase64,
        contentType: inlineImage.contentType,
        cid: IMAGE_CID,
      });
    }
    const results: SendResult[] = [];

    for (let index = 0; index < recipients.length; index++) {
      const recipient = recipients[index];
      if (index > 0) await delay(SEND_DELAY_MS);

      const subject = replaceVariables(subjectTemplate, recipient.vars).trim();
      const html = buildHtml(
        replaceVariables(bodyTemplate, recipient.vars),
        inlineImage ? { imageCid: IMAGE_CID } : undefined
      );
      // El marcador {{imagen}} solo tiene sentido en el HTML; en el texto plano
      // (y en el historial, que lo muestra tal cual) se elimina.
      const text = stripImagePlaceholder(replaceVariables(bodyTemplate, recipient.vars));

      try {
        if (!subject || !text.trim()) throw new Error("Asunto o contenido vacío");

        await sendEmail({
          to: recipient.to,
          subject,
          text,
          html,
          remitente: "cartera",
          attachments: mailAttachments,
        });

        // El correo ya salió: si el seguimiento falla se deja constancia en los
        // logs, pero el destinatario NO se marca como fallido. Marcarlo llevaba a
        // reenviar la campaña y a que el deudor recibiera el correo dos veces.
        if (claimed.clienteId && recipient.deudorId) {
          try {
            await registrarSeguimientoCorreo({
              clienteId: String(claimed.clienteId),
              deudorId: recipient.deudorId,
              tipificacion: recipient.tipificacion,
              ejecutivoUID: agentId,
              descripcion: `Se envió el correo "${subject}" a ${recipient.to}.`,
            });
          } catch (error) {
            logger.error("[processEmailCampaign] No se pudo registrar el seguimiento", {
              campaignId: campaignRef.id,
              deudorId: recipient.deudorId,
              message: error instanceof Error ? error.message : String(error),
            });
          }
        }

        results.push({ to: recipient.to, deudorNombre: recipient.deudorNombre, status: "ok" });
        await campaignRef.collection("deliveries").add({
          to: recipient.to,
          deudorId: recipient.deudorId ?? null,
          deudorNombre: recipient.deudorNombre,
          subject,
          text,
          attachmentNames: attachments.map((attachment) => attachment.filename),
          inlineImageName: inlineImage?.filename ?? null,
          status: "ok",
          sentAt: FieldValue.serverTimestamp(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        logger.error("[processEmailCampaign] Error", { campaignId: campaignRef.id, to: recipient.to, message });
        results.push({ to: recipient.to, deudorNombre: recipient.deudorNombre, status: "error", error: message });
        await campaignRef.collection("deliveries").add({
          to: recipient.to,
          deudorId: recipient.deudorId ?? null,
          deudorNombre: recipient.deudorNombre,
          subject,
          text,
          status: "error",
          error: message,
          sentAt: FieldValue.serverTimestamp(),
        });
      }

      if ((index + 1) % PROGRESS_EVERY === 0) {
        const parcial = results.filter((result) => result.status === "ok").length;
        await campaignRef.update({
          processed: results.length,
          sent: parcial,
          failed: results.length - parcial,
        });
      }
    }

    const sent = results.filter((result) => result.status === "ok").length;
    await campaignRef.update({
      status: "done",
      processed: results.length,
      sent,
      failed: results.length - sent,
      results,
      // Ya no hacen falta y son lo más pesado del documento.
      recipients: FieldValue.delete(),
      attachments: FieldValue.delete(),
      inlineImage: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
);

/**
 * Historial de campañas. Si llega `clienteId` devuelve solo las de ese conjunto
 * (es como lo consume la pantalla de correos dentro del cliente); sin él,
 * devuelve las últimas de todos los conjuntos.
 */
export const getEmailCampaignHistory = onCall(
  { region: "us-central1" },
  async (request) => {
    const solicitante = await assertPuedeUsarCorreos(request.auth?.uid);
    const db = getFirestore();

    const clienteId = String((request.data as { clienteId?: string } | undefined)?.clienteId ?? "").trim();
    // Sin clienteId se devolverían las campañas de todos los conjuntos, así que
    // el listado global queda solo para quien ya ve todas las carteras.
    await assertAccesoAlConjunto(solicitante, clienteId);
    const base = db.collection("emailCampaigns");
    // Requiere el índice compuesto (clienteId ASC, createdAt DESC) de firestore.indexes.json.
    const query = clienteId ? base.where("clienteId", "==", clienteId) : base;
    const snap = await query.orderBy("createdAt", "desc").limit(100).get();

    const campaigns = snap.docs
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
          attachmentNames: (data.attachmentNames ?? []) as string[],
          total: data.total ?? 0,
          sent: data.sent ?? 0,
          failed: data.failed ?? 0,
          status: data.status ?? "",
          createdAtMs: data.createdAt?.toMillis?.() ?? 0,
        };
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs);

    return { campaigns };
  }
);
