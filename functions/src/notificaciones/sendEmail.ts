// functions/src/twilio/sendEmail.ts
import { defineSecret } from "firebase-functions/params";
import nodemailer from "nodemailer";
import { google } from "googleapis";

// 🔐 Secrets para Gmail OAuth2
export const GMAIL_USER = defineSecret("GMAIL_USER");                 // gestionglobalacg@gestionglobalacg.com
export const GMAIL_CLIENT_ID = defineSecret("GMAIL_CLIENT_ID");       // client_id de OAuth
export const GMAIL_CLIENT_SECRET = defineSecret("GMAIL_CLIENT_SECRET"); // client_secret de OAuth
export const GMAIL_REFRESH_TOKEN = defineSecret("GMAIL_REFRESH_TOKEN"); // refresh_token del Playground

type SendEmailOptions = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

export const sendEmail = async (opts: SendEmailOptions): Promise<string> => {
  console.log("[sendEmail] init (Gmail OAuth2)");

  const user = GMAIL_USER.value();
  const clientId = GMAIL_CLIENT_ID.value();
  const clientSecret = GMAIL_CLIENT_SECRET.value();
  const refreshToken = GMAIL_REFRESH_TOKEN.value();

  if (!user || !clientId || !clientSecret || !refreshToken) {
    console.error("[sendEmail] Faltan credenciales de Gmail");
    throw new Error("Faltan credenciales de Gmail");
  }

  // Cliente OAuth2 de Google
  const oAuth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "https://developers.google.com/oauthplayground" // el mismo redirect del Playground
  );

  oAuth2Client.setCredentials({ refresh_token: refreshToken });

  const accessTokenObj = await oAuth2Client.getAccessToken();
  const accessToken = typeof accessTokenObj === "string"
    ? accessTokenObj
    : accessTokenObj?.token;

  if (!accessToken) {
    throw new Error("No se pudo obtener access_token de OAuth2");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user,
      clientId,
      clientSecret,
      refreshToken,
      accessToken,
    },
  });

  const info = await transporter.sendMail({
    from: `"Gestión Global ACG" <${user}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });

  console.log("[sendEmail] messageId:", info.messageId);
  return info.messageId || "correo-enviado";
};
