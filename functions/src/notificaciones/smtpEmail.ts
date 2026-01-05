import nodemailer from "nodemailer";
import { defineSecret } from "firebase-functions/params";

export const SMTP_USER = defineSecret("SMTP_USER");
export const SMTP_PASS = defineSecret("SMTP_PASS");

export const sendEmailSMTP = async (
  to: string,
  subject: string,
  html: string
) => {
  const user = SMTP_USER.value();
  const pass = SMTP_PASS.value();

  console.log("[sendEmailSMTP] Enviando correo:", { to, subject, from: user });

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from: `"Gestión Global" <${user}>`,
    to,
    subject,
    html,
  });

  console.log("[sendEmailSMTP] OK messageId:", info.messageId);
  return info.messageId;
};
