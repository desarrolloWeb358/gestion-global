// functions/src/twilio/sendEmail.ts
import { defineSecret } from "firebase-functions/params";
import nodemailer from "nodemailer";

// 🔐 Secrets para Gmail OAuth2
export const GMAIL_USER = defineSecret("GMAIL_USER");                 // gestionglobalacg@gestionglobalacg.com
export const GMAIL_CLIENT_ID = defineSecret("GMAIL_CLIENT_ID");       // client_id de OAuth
export const GMAIL_CLIENT_SECRET = defineSecret("GMAIL_CLIENT_SECRET"); // client_secret de OAuth
export const GMAIL_REFRESH_TOKEN = defineSecret("GMAIL_REFRESH_TOKEN"); // refresh_token del Playground

// 🔐 Credenciales propias del buzón de cartera. El client_id/client_secret no se
// repiten: identifican a la aplicación (el cliente OAuth del proyecto), no a la
// cuenta. Lo único que amarra un token a un buzón es el refresh_token, así que
// darle cuenta propia a un remitente son solo estos dos secrets.
export const GMAIL_USER_CARTERA = defineSecret("GMAIL_USER_CARTERA");
export const GMAIL_REFRESH_TOKEN_CARTERA = defineSecret("GMAIL_REFRESH_TOKEN_CARTERA");

/**
 * Direcciones desde las que sale el correo de la plataforma.
 *
 * Hay dos formas de salir, y la diferencia importa:
 *
 * 1. Con cuenta propia (ver CUENTAS_PROPIAS): autentica contra Gmail como esa
 *    dirección. El sobre SMTP, el Return-Path (o sea, los rebotes) y la copia en
 *    "Enviados" quedan en SU buzón.
 *
 * 2. Por alias: solo cambia la cabecera From, la conexión sigue siendo la de
 *    GMAIL_USER. Funciona porque la dirección está registrada en ESA cuenta como
 *    "Enviar mensajes como" (Gmail > Configuración > Cuentas e importación) y
 *    verificada con "Tratar como un alias". Los rebotes y la copia en "Enviados"
 *    quedan en el buzón de GMAIL_USER, no en el del remitente.
 *
 * Ojo con el modo alias: si la dirección se borra de esa pantalla, Gmail no
 * falla, reescribe el From de vuelta a GMAIL_USER y el correo sale igual pero
 * con el remitente equivocado. Antes de agregar aquí una dirección nueva sin
 * cuenta propia, verifícala primero allá.
 */
export const REMITENTES = {
  /** Valores agregados y recordatorios de plazos legales. Es la cuenta que autentica por defecto. */
  general: { email: "gestionglobalacg@gestionglobalacg.com", nombre: "Gestión Global ACG" },
  /** Campañas de correo a deudores y avisos de acuerdos en firme. Tiene cuenta propia. */
  cartera: { email: "carterazona1@gestionglobalacg.com", nombre: "Gestión Global ACG" },
  /** Todo el módulo de calendario: invitaciones, recordatorios y agenda diaria. Sale por alias. */
  agenda: { email: "asistentegerencia@gestionglobalacg.com", nombre: "Gestión Global ACG" },
} as const;

export type Remitente = keyof typeof REMITENTES;

/**
 * Remitentes que autentican con su propio buzón en vez de salir como alias de
 * GMAIL_USER. Para darle cuenta propia a otro remitente: se crean sus dos
 * secrets, se agregan aquí, y se declaran en el array `secrets` de las funciones
 * que envían con ese remitente (sin eso, el envío cae al modo alias).
 */
const CUENTAS_PROPIAS: Partial<
  Record<Remitente, { user: ReturnType<typeof defineSecret>; refreshToken: ReturnType<typeof defineSecret> }>
> = {
  cartera: { user: GMAIL_USER_CARTERA, refreshToken: GMAIL_REFRESH_TOKEN_CARTERA },
};

type SendEmailAttachment = {
  filename: string;
  contentBase64: string;
  contentType?: string;
  /**
   * Content-ID para incrustar el archivo en el HTML con `<img src="cid:...">`.
   * Con cid el adjunto se manda como `inline`, así el cliente de correo lo
   * pinta dentro del cuerpo en vez de listarlo como archivo adjunto.
   */
  cid?: string;
};

type SendEmailOptions = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: SendEmailAttachment[];
  /**
   * Desde cuál de las tres direcciones sale. Por omisión `general`, para que
   * cualquier envío que no lo especifique siga saliendo como siempre.
   */
  remitente?: Remitente;
};

// Reutilizamos un único transporter por cuenta (y su token OAuth2 interno)
// entre envíos. Antes cada llamada a sendEmail creaba un OAuth2Client nuevo y
// pedía un access_token nuevo a Google, lo que en un envío masivo (30+ correos
// seguidos) terminaba chocando con el rate limit del endpoint de tokens de
// Google: los primeros ~30 correos salían bien y el resto empezaba a fallar
// silenciosamente aunque el ciclo de envío seguía intentando con los que
// quedaban. Nodemailer refresca el access_token internamente solo cuando
// expira, así que basta con no recrear el transporter en cada envío.
//
// La clave del cache es la cuenta que autentica, no el remitente: los
// remitentes que salen por alias comparten el transporter de GMAIL_USER, y el
// de cartera va aparte porque autentica con su propio refresh_token.
const transporters = new Map<string, nodemailer.Transporter>();

function getTransporter(clave: Remitente): nodemailer.Transporter {
  const clientId = GMAIL_CLIENT_ID.value();
  const clientSecret = GMAIL_CLIENT_SECRET.value();

  // `.value()` de un secret que la función no declaró en su array `secrets`
  // devuelve "" (con un warning en los logs), no revienta. Así que si los
  // secrets de la cuenta propia todavía no existen, o la función que envía no
  // los declaró, caemos al modo alias de siempre: preferimos que el correo
  // salga con el remitente viejo antes que no salga.
  const propia = CUENTAS_PROPIAS[clave];
  const userPropio = propia ? propia.user.value().trim() : "";
  const refreshTokenPropio = propia ? propia.refreshToken.value().trim() : "";
  const usaCuentaPropia = Boolean(userPropio && refreshTokenPropio);

  if (propia && !usaCuentaPropia) {
    console.warn(
      `[sendEmail] El remitente "${clave}" no tiene credenciales propias disponibles; ` +
        "sale como alias de la cuenta general."
    );
  }

  const user = usaCuentaPropia ? userPropio : GMAIL_USER.value();
  const refreshToken = usaCuentaPropia ? refreshTokenPropio : GMAIL_REFRESH_TOKEN.value();

  if (!user || !clientId || !clientSecret || !refreshToken) {
    console.error("[sendEmail] Faltan credenciales de Gmail");
    throw new Error("Faltan credenciales de Gmail");
  }

  const cacheKey = `${clientId}|${user}`;
  const cached = transporters.get(cacheKey);
  if (cached) return cached;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user,
      clientId,
      clientSecret,
      refreshToken,
    },
  });
  transporters.set(cacheKey, transporter);

  return transporter;
}

export const sendEmail = async (opts: SendEmailOptions): Promise<string> => {
  const clave = opts.remitente ?? "general";
  const remitente = REMITENTES[clave];
  const transporter = getTransporter(clave);

  const info = await transporter.sendMail({
    from: `"${remitente.nombre}" <${remitente.email}>`,
    // Sin esto, un cliente de correo que ignore el From y use el Sender (la
    // cuenta que autentica) mandaría la respuesta al buzón equivocado. Con
    // cuenta propia las dos direcciones coinciden y es redundante, pero para los
    // remitentes que siguen saliendo por alias sigue haciendo falta.
    replyTo: remitente.email,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    attachments: opts.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.contentBase64,
      encoding: "base64" as const,
      contentType: attachment.contentType,
      ...(attachment.cid
        ? { cid: attachment.cid, contentDisposition: "inline" as const }
        : {}),
    })),
  });

  console.log("[sendEmail] messageId:", info.messageId, "desde:", remitente.email);
  return info.messageId || "correo-enviado";
};
