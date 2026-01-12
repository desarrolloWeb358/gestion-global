import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import { sendSMS } from './twilio/sendSMS';
import { sendWhatsAppTemplate } from './twilio/sendWhatsApp';
import { GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } from "./notificaciones/sendEmail";
import { sendEmail } from "./notificaciones/sendEmail";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "./twilio/client";
import { consultarPersonasService } from "./consultas/consultarPersonas";
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

admin.initializeApp();

export const consultarPersonas = onRequest(async (req, res) => {

  // Habilitar CORS manualmente
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Si es una solicitud preflight OPTIONS, respondemos y terminamos
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  try {
    const { uid, ...formData } = req.body;
    console.log("Datos recibidos:", formData);
    console.log("UID del usuario:", uid);

    // UIDs autorizados (puedes añadir más)
    const UID_AUTORIZADOS = ['jqONlD5XRaWIfheDDunWRvuLdDc2'];

    if (!UID_AUTORIZADOS.includes(uid)) {
      console.log("UID no autorizado:", uid);
      res.status(200).send("SIN_AUTORIZACION");
      return;
    }

    const resultado = await consultarPersonasService(formData);
    console.log("Resultado de la consulta:", resultado);

    res.status(200).send(resultado);
  } catch (error) {
    console.error("Error en consulta de personas:", error);
    res.status(500).send("Error consultando datos");
  }
});

export const enviarNotificacion = onRequest(
  {
    secrets: [
      GMAIL_USER,
      GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET,
      GMAIL_REFRESH_TOKEN,
    ],
  },
  async (req, res) => {
    console.log("Solicitud recibida para enviar notificación:", req.body);

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      const { to, subject, text, html } = req.body;

      if (!to || !subject) {
        res.status(400).send("Faltan parámetros obligatorios: to, subject");
        return;
      }

      const messageId = await sendEmail({
        to,
        subject,
        text,
        html,
      });

      res.status(200).send({ success: true, messageId });
    } catch (error) {
      console.error("Error al enviar notificación:", error);
      res.status(500).send("Error al enviar la notificación.");
    }
  }
);

// Enviar notificaciones por correo electrónico (SMTP)



// **********************
// pruebas
// **********************

export const helloWorld = onRequest((req, res) => {
  logger.info("Hello logs!", { structuredData: true });
  res.send("✅ Función helloWorld desplegada con éxito");
});

export const pruebaMensajes = onRequest({
  secrets: [
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
  ],
}, async (req, res) => {
  try {
    console.log('Prueba de función iniciada para enviar SMS o WhatsApp');
    const to = (req.query.to as string) || '+573005648696';
    const body = (req.query.body as string) || 'Mensaje de prueba desde Firebase Cloud Functions';

    const sid1 = await sendSMS(to, body);
    const sid2 = await sendWhatsAppTemplate(to, 'HXbd13390ec3d15e0d615a3d2f8f0f5816'); // SID del template de prueba

    res.status(200).send(`Mensaje enviado correctamente. SID: ${sid1} y SID WhatsApp: ${sid2}`);
  } catch (error) {
    console.error('Error al enviar SMS:', error);
    res.status(500).send('Fallo al enviar el SMS');
  }
});

export const borrarDeudorCompleto = onCall(
  {
    region: "us-central1",
    cors: ["http://localhost:5173", "http://127.0.0.1:5173"], // ✅ importante
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

    const { clienteId, deudorId } = request.data as { clienteId?: string; deudorId?: string };
    if (!clienteId || !deudorId) {
      throw new HttpsError("invalid-argument", "clienteId y deudorId son requeridos.");
    }

    const db = admin.firestore();
    const deudorRef = db.collection("clientes").doc(clienteId).collection("deudores").doc(deudorId);

    await db.recursiveDelete(deudorRef);

    return { ok: true };
  }
);


async function requireAuth(req: any) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) throw new Error("UNAUTHENTICATED");
  return admin.auth().verifyIdToken(token);
}

async function requireAdmin(decoded: admin.auth.DecodedIdToken) {
  if (!decoded.admin) throw new Error("FORBIDDEN");
}

export const crearUsuarioDesdeAdmin = onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const decoded = await requireAuth(req);
    await requireAdmin(decoded);

    const {
      email,
      password,
      nombre,
      telefonoUsuario,
      tipoDocumento,
      numeroDocumento,
      roles,
      activo = true,
      fecha_registro,
      asociadoA = null,
    } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({ error: "Faltan email o password" });
      return;
    }
    if (!Array.isArray(roles) || roles.length === 0) {
      res.status(400).json({ error: "Debes enviar roles[]" });
      return;
    }

    const user = await admin.auth().createUser({
      email,
      password,
      displayName: nombre ?? "",
      disabled: !Boolean(activo),
    });

    // Opcional: guardar roles como custom claims (recomendado para seguridad)
    await admin.auth().setCustomUserClaims(user.uid, { roles, activo: Boolean(activo) });

    // Guardar perfil en Firestore
    await admin.firestore().collection("usuarios").doc(user.uid).set(
      {
        uid: user.uid,
        email,
        nombre: nombre ?? "",
        telefonoUsuario: telefonoUsuario ?? "",
        tipoDocumento: tipoDocumento ?? null,
        numeroDocumento: numeroDocumento ?? "",
        roles,
        activo: Boolean(activo),
        asociadoA,
        fecha_registro: fecha_registro ? admin.firestore.Timestamp.fromDate(new Date(fecha_registro)) : admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: decoded.uid,
      },
      { merge: true }
    );

    res.status(200).json({ uid: user.uid });
  } catch (e: any) {
    console.error(e);
    if (e?.message === "UNAUTHENTICATED") {
      res.status(401).json({ error: "No autenticado" });
    } else if (e?.message === "FORBIDDEN") {
      res.status(403).json({ error: "No autorizado" });
    } else {
      res.status(500).json({ error: e?.message ?? "Error creando usuario" });
    }
  }
});








/*
export const pruebaCorreo = onRequest({ secrets: [SENDGRID_API_KEY, SENDGRID_SENDER_EMAIL] }, async (req, res) => {
  try {
    console.log('Prueba de envío de correo iniciada');
    console.log('SENDGRID_API_KEY:', SENDGRID_API_KEY.value());
    console.log('SENDGRID_SENDER_EMAIL:', SENDGRID_SENDER_EMAIL.value());

    const to = req.query.to as string || "juanpabloduque@gmail.com";
    const subject = "Correo de prueba desde Firebase";
    const body = "Este es un correo de prueba enviado con SendGrid";

    const messageId = await sendEmail(to, subject, body);
    res.status(200).send(`Correo enviado. ID: ${messageId}`);
  } catch (error) {
    console.error("Error al enviar correo:", error);
    res.status(500).send("Error al enviar correo");
  }
}
);



// Enviar notificaciones por correo electrónico, SMS o WhatsApp
export const enviarNotificacion = onRequest({
  secrets: [
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    SENDGRID_API_KEY,
    SENDGRID_SENDER_EMAIL
  ],
}, async (req, res) => {

  console.log("Solicitud recibida para enviar notificación:", req.body);

  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { tipo, destino, templateId, templateData, archivoUrl, mensaje } = req.body;

    if (!tipo || !destino) {
      res.status(400).send('Faltan parámetros obligatorios.');
      return;
    }


    let resultado;

    switch (tipo) {
      case 'sms':
        if (!mensaje) {
          res.status(400).send('Falta el mensaje para SMS.');
          return;
        }
        resultado = await sendSMS(destino, mensaje);
        break;

      case 'whatsapp':
        if (!templateId) {
          res.status(400).send('Falta el SID del template para WhatsApp.');
          return;
        }
        resultado = await sendWhatsAppTemplate(destino, templateId, templateData); // Aquí se asume que 'mensaje' es el SID del template
        break;

      case 'correo':
        console.log("Enviando correo a:", destino);
        if (!templateId || !templateData) {
          res.status(400).send('Faltan templateId o templateData para correo.');
          return;
        }
        resultado = await sendEmail(destino, templateId, templateData, archivoUrl);
        break;

        
      case 'llamada':
        if (!archivoUrl) {
          res.status(400).send('Falta la URL del archivo de audio para la llamada.');
          return;
        }
        resultado = await sendCall(destino, archivoUrl);
        break;

      default:
        res.status(400).send('Tipo de notificación no válido.');
        return;
    }

    res.status(200).send({ success: true, resultado });
  } catch (error) {
    console.error('Error al enviar notificación:', error);
    res.status(500).send('Error al enviar la notificación.');
  }
});



export const enviarNotificacionAnterior = onRequest(
  {
    secrets: [
      SMTP_HOST,
      SMTP_PORT,
      SMTP_USER,
      SMTP_PASS,
      SMTP_FROM,
    ],
  },
  async (req, res) => {
    console.log("Solicitud recibida para enviar notificación:", req.body);

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      const { to, subject, text, html } = req.body;

      if (!to || !subject) {
        res.status(400).send("Faltan parámetros obligatorios: to, subject");
        return;
      }

      const messageId = await sendEmail({
        to,
        subject,
        text,
        html,
      });

      res.status(200).send({ success: true, messageId });
    } catch (error) {
      console.error("Error al enviar notificación:", error);
      res.status(500).send("Error al enviar la notificación.");
    }
  }
);

*/


