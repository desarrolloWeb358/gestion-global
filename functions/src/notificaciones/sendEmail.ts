// functions/src/twilio/sendEmail.ts
import { defineSecret } from "firebase-functions/params";
import nodemailer from "nodemailer";

// 🔐 Secrets para Gmail OAuth2
export const GMAIL_USER = defineSecret("GMAIL_USER");                 // gestionglobalacg@gestionglobalacg.com
export const GMAIL_CLIENT_ID = defineSecret("GMAIL_CLIENT_ID");       // client_id de OAuth
export const GMAIL_CLIENT_SECRET = defineSecret("GMAIL_CLIENT_SECRET"); // client_secret de OAuth
export const GMAIL_REFRESH_TOKEN = defineSecret("GMAIL_REFRESH_TOKEN"); // refresh_token del Playground

type SendEmailAttachment = {
  filename: string;
  contentBase64: string;
  contentType?: string;
};

type SendEmailOptions = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: SendEmailAttachment[];
};

// Reutilizamos un único transporter (y su token OAuth2 interno) entre envíos.
// Antes cada llamada a sendEmail creaba un OAuth2Client nuevo y pedía un
// access_token nuevo a Google, lo que en un envío masivo (30+ correos
// seguidos) terminaba chocando con el rate limit del endpoint de tokens de
// Google: los primeros ~30 correos salían bien y el resto empezaba a fallar
// silenciosamente aunque el ciclo de envío seguía intentando con los que
// quedaban. Nodemailer refresca el access_token internamente solo cuando
// expira, así que basta con no recrear el transporter en cada envío.
let cachedTransporter: nodemailer.Transporter | null = null;
let cachedUser: string | null = null;

function getTransporter(): { transporter: nodemailer.Transporter; user: string } {
  const user = GMAIL_USER.value();
  const clientId = GMAIL_CLIENT_ID.value();
  const clientSecret = GMAIL_CLIENT_SECRET.value();
  const refreshToken = GMAIL_REFRESH_TOKEN.value();

  if (!user || !clientId || !clientSecret || !refreshToken) {
    console.error("[sendEmail] Faltan credenciales de Gmail");
    throw new Error("Faltan credenciales de Gmail");
  }

  if (cachedTransporter && cachedUser === user) {
    return { transporter: cachedTransporter, user };
  }

  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user,
      clientId,
      clientSecret,
      refreshToken,
    },
  });
  cachedUser = user;

  return { transporter: cachedTransporter, user };
}

export const sendEmail = async (opts: SendEmailOptions): Promise<string> => {
  const { transporter, user } = getTransporter();

  const info = await transporter.sendMail({
    from: `"Gestión Global ACG" <${user}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    attachments: opts.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.contentBase64,
      encoding: "base64" as const,
      contentType: attachment.contentType,
    })),
  });

  console.log("[sendEmail] messageId:", info.messageId);
  return info.messageId || "correo-enviado";
};
