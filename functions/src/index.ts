import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
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
    invoker: "public", // ✅ IMPORTANTÍSIMO para que Cloud Run no bloquee
  },
  async (request) => {
    logger.info("borrarDeudorCompleto called", { uid: request.auth?.uid, data: request.data });
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    }
    const { clienteId, deudorId } = request.data as {
      clienteId?: string;
      deudorId?: string;
    };

    if (!clienteId || !deudorId) {
      throw new HttpsError("invalid-argument", "clienteId y deudorId son requeridos.");
    }

    const db = admin.firestore();
    const deudorRef = db
      .collection("clientes")
      .doc(clienteId)
      .collection("deudores")
      .doc(deudorId);

    logger.info("recursiveDelete", { path: deudorRef.path, uid: request.auth.uid });

    await db.recursiveDelete(deudorRef);

    await db.collection("registrosEliminados").add({
      uid: request.auth.uid,
      modulo: "deudor",
      descripcion: `Deudor eliminado con todas sus subcolecciones - deudorId: ${deudorId}`,
      coleccionPath: `clientes/${clienteId}/deudores`,
      fechaEliminacion: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { ok: true };
  }
);


function setCors(req: any, res: any) {
  const origin = req.headers.origin || "*";
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function requireAuth(req: any) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) throw new Error("UNAUTHENTICATED");
  return admin.auth().verifyIdToken(token);
}

async function requireAdminFromFirestore(uid: string) {
  const snap = await admin.firestore().collection("usuarios").doc(uid).get();
  const roles = snap.data()?.roles;

  if (
    !Array.isArray(roles) ||
    !(roles.includes("admin") || roles.includes("ejecutivoAdmin"))
  ) {
    throw new Error("FORBIDDEN");
  }
}

export const crearUsuarioDesdeAdmin = onRequest(
  { region: "us-central1" },
  async (req, res): Promise<void> => {
    setCors(req, res);

    // Preflight CORS
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }


    try {
      const decoded = await requireAuth(req);
      await requireAdminFromFirestore(decoded.uid);

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
        clienteIdAsociado,
        deudorIdAsociado,
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
        disabled: false,
      });

      await admin.auth().setCustomUserClaims(user.uid, {
        roles,
        activo: Boolean(activo),
      });

      let fechaRegistro: any = admin.firestore.FieldValue.serverTimestamp();
      if (fecha_registro) {
        const d = new Date(fecha_registro);
        if (!isNaN(d.getTime())) {
          fechaRegistro = admin.firestore.Timestamp.fromDate(d);
        }
      }

      const db = admin.firestore();
      const batch = db.batch();
      const userDoc = db.collection("usuarios").doc(user.uid);
      batch.set(userDoc, {
        uid: user.uid,
        email,
        nombre: nombre ?? "",
        telefonoUsuario: telefonoUsuario ?? "",
        tipoDocumento: tipoDocumento ?? null,
        numeroDocumento: numeroDocumento ?? "",
        roles,
        activo: true as any,
        clienteIdAsociado: clienteIdAsociado ?? null,
        deudorIdAsociado: deudorIdAsociado ?? null,
        fecha_registro: fechaRegistro,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: decoded.uid,
      }, { merge: true });

      // guardar tambien en coleccion clientes si trae el rol de cliente
      if (roles.includes("cliente")) {
        const clienteDoc = db.collection("clientes").doc(user.uid);
        batch.set(clienteDoc, {
          nombre: nombre ?? "",
          direccion: "",
          formaPago: "",
          ejecutivoPrejuridicoId: null as any,
          ejecutivoJuridicoId: null as any,
          ejecutivoDependienteId: null as any,
          abogadoId: null as any,
          activo: true as any,
          fecha_creacion: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      await batch.commit();

      res.status(200).json({ uid: user.uid });
      return;
    } catch (e: any) {
      console.error(e);

      const code = e?.code || "";
      if (e?.message === "UNAUTHENTICATED") {
        res.status(401).json({ error: "No autenticado" });
        return;
      }
      if (e?.message === "FORBIDDEN") {
        res.status(403).json({ error: "No autorizado" });
        return;
      }
      if (code === "auth/email-already-exists") {
        res.status(409).json({ error: "El email ya existe" });
        return;
      }
      if (code === "auth/invalid-password") {
        res.status(400).json({ error: "Password inválido (mínimo 6 caracteres)" });
        return;
      }

      res.status(500).json({ error: e?.message ?? "Error creando usuario" });
      return;
    }
  }
);

// =====================================================
// ⏰ RECORDATORIO DIARIO DE PLAZOS LEGALES
// Corre todos los días a las 7:00 AM hora Colombia
// =====================================================
export const recordatorioPlazosLegales = onSchedule(
  {
    schedule: "0 12 * * *", // 7am Colombia = 12pm UTC
    timeZone: "America/Bogota",
    secrets: [
      GMAIL_USER,
      GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET,
      GMAIL_REFRESH_TOKEN,
    ],
  },
  async () => {
    const db = admin.firestore();
    const ahora = new Date();

    logger.info("[recordatorioPlazosLegales] Iniciando revisión de plazos", {
      ahora: ahora.toISOString(),
    });

    const hace3Dias = new Date(ahora);
    hace3Dias.setDate(hace3Dias.getDate() - 3);

    const en48h = new Date(ahora);
    en48h.setHours(en48h.getHours() + 48);

    const snap = await db
      .collectionGroup("valoresAgregados")
      .where("completado", "==", false)
      .where("fechaLimite", ">=", admin.firestore.Timestamp.fromDate(hace3Dias))
      .where("fechaLimite", "<=", admin.firestore.Timestamp.fromDate(en48h))
      .get();

    logger.info(`[recordatorioPlazosLegales] Encontrados ${snap.size} valores pendientes`);

    if (snap.empty) return;

    for (const docSnap of snap.docs) {
      try {
        const data = docSnap.data() as any;
        const ref = docSnap.ref;

        // Ruta: clientes/{clienteId}/valoresAgregados/{valorId}
        const pathParts = ref.path.split("/");
        const clienteId = pathParts[1];
        const valorId = pathParts[3];

        const clienteSnap = await db.collection("clientes").doc(clienteId).get();
        if (!clienteSnap.exists) continue;

        const clienteData = clienteSnap.data() as any;
        const abogadoId: string | undefined = clienteData?.abogadoId;
        const nombreCliente: string = clienteData?.nombre || clienteId;

        if (!abogadoId) {
          logger.warn(`[recordatorioPlazosLegales] Cliente ${clienteId} sin abogadoId, omitiendo`);
          continue;
        }

        const abogadoSnap = await db.collection("usuarios").doc(abogadoId).get();
        if (!abogadoSnap.exists) continue;

        const abogadoData = abogadoSnap.data() as any;
        const correoAbogado: string | undefined = abogadoData?.email;
        const nombreAbogado: string = abogadoData?.nombre || "Abogado";

        if (!correoAbogado) {
          logger.warn(`[recordatorioPlazosLegales] Abogado ${abogadoId} sin correo, omitiendo`);
          continue;
        }

        const fechaLimiteDate: Date = (data.fechaLimite as admin.firestore.Timestamp).toDate();
        const diferenciaMs = fechaLimiteDate.getTime() - ahora.getTime();
        const diferenciaHoras = Math.round(diferenciaMs / (1000 * 60 * 60));

        const tipoLabel: string = data.tipo || "Valor agregado";
        const titulo: string = data.titulo || "Sin título";

        let urgencia: string;
        let colorUrgencia: string;

        if (diferenciaMs < 0) {
          const horasVencido = Math.abs(diferenciaHoras);
          urgencia = `⛔ VENCIDO hace ${horasVencido < 24 ? `${horasVencido} horas` : `${Math.round(horasVencido / 24)} días`}`;
          colorUrgencia = "#dc2626";
        } else if (diferenciaHoras <= 24) {
          urgencia = `🚨 VENCE HOY / en ${diferenciaHoras} horas`;
          colorUrgencia = "#ea580c";
        } else {
          const diasRestantes = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24));
          urgencia = `⚠️ Vence en ${diasRestantes} día(s)`;
          colorUrgencia = "#d97706";
        }

        const fechaLimiteStr = fechaLimiteDate.toLocaleDateString("es-CO", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        const ruta = `/clientes/${clienteId}/valores-agregados/${valorId}`;
        const subject = `[Recordatorio] Plazo legal: ${tipoLabel} - ${nombreCliente}`;

        const cuerpoHtml = `
          <p style="font-size:16px;font-weight:bold;color:${colorUrgencia};">${urgencia}</p>
          <p>Hay un valor agregado pendiente de resolución:</p>
          <table style="border-collapse:collapse;width:100%;font-size:14px;">
            <tr><td style="padding:6px;font-weight:bold;color:#374151;">Cliente:</td><td style="padding:6px;">${nombreCliente}</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:6px;font-weight:bold;color:#374151;">Tipo:</td><td style="padding:6px;">${tipoLabel}</td></tr>
            <tr><td style="padding:6px;font-weight:bold;color:#374151;">Título:</td><td style="padding:6px;">${titulo}</td></tr>
            <tr style="background:#f9fafb;"><td style="padding:6px;font-weight:bold;color:#374151;">Fecha límite:</td><td style="padding:6px;color:${colorUrgencia};font-weight:bold;">${fechaLimiteStr}</td></tr>
          </table>
          <p style="margin-top:16px;">Ingresa a la plataforma para revisar y marcar como completado cuando esté resuelto.</p>
        `;

        const htmlEmail = `
          <!doctype html>
          <html lang="es">
          <head><meta charset="utf-8"/><title>${subject}</title></head>
          <body style="margin:0;padding:0;font-family:system-ui,sans-serif;background:#f3f4f6;">
            <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
              <tr><td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 10px 15px rgba(0,0,0,0.05);">
                  <tr><td style="background:#111827;color:#f9fafb;padding:16px 24px;">
                    <h1 style="margin:0;font-size:20px;">Gestión Global</h1>
                    <p style="margin:4px 0 0;font-size:13px;opacity:.8;">Plataforma de gestión de cartera</p>
                  </td></tr>
                  <tr><td style="padding:24px;">
                    <p style="margin-top:0;">Hola <strong>${nombreAbogado}</strong>,</p>
                    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Recordatorio de plazo legal</h2>
                    <div style="font-size:14px;color:#374151;line-height:1.5;">${cuerpoHtml}</div>
                    <p style="margin-top:24px;font-size:12px;color:#6b7280;">
                      Este es un recordatorio automático. Si ya resolviste este caso, márcalo como completado en la plataforma para dejar de recibir recordatorios.
                    </p>
                  </td></tr>
                  <tr><td style="background:#f9fafb;padding:16px 24px;text-align:center;font-size:11px;color:#9ca3af;">
                    © ${new Date().getFullYear()} Gestión Global. Todos los derechos reservados.
                  </td></tr>
                </table>
              </td></tr>
            </table>
          </body>
          </html>
        `;

        // 1) Alerta en la app
        await db.collection(`usuarios/${abogadoId}/notificaciones`).add({
          descripcion: `[Recordatorio] ${urgencia} — ${tipoLabel}: ${titulo} (${nombreCliente})`,
          ruta,
          modulo: "valor_agregado",
          visto: false,
          fecha: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 2) Correo
        await sendEmail({
          to: correoAbogado,
          subject,
          text: `Recordatorio: ${urgencia} — ${tipoLabel}: ${titulo} (${nombreCliente}). Fecha límite: ${fechaLimiteStr}`,
          html: htmlEmail,
        });

        logger.info(`[recordatorioPlazosLegales] Notificado abogado ${abogadoId} para valor ${valorId}`);
      } catch (err) {
        logger.error("[recordatorioPlazosLegales] Error procesando valor:", err);
      }
    }

    logger.info("[recordatorioPlazosLegales] Revisión completada");
  }
);

if (!admin.apps.length) admin.initializeApp();

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const cambiarCorreoUsuarioDesdeAdmin = onCall(async (request) => {
  const authCtx = request.auth;
  if (!authCtx) throw new HttpsError("unauthenticated", "No autenticado.");

  const { uid, emailNuevo } = request.data || {};
  if (!uid) throw new HttpsError("invalid-argument", "Falta uid.");

  const email = String(emailNuevo ?? "").trim().toLowerCase();
  if (!emailRe.test(email)) {
    throw new HttpsError("invalid-argument", "Correo inválido.");
  }

  // ✅ RBAC: solo admin
  const solicitanteSnap = await admin.firestore().doc(`usuarios/${authCtx.uid}`).get();
  const solicitante = solicitanteSnap.data() as any;
  const rolesSolicitante: string[] = solicitante?.roles ?? [];
  // si el rol del solicitante no incluye 'admin' o 'ejecutivoAdmin', lanza error
  if (!rolesSolicitante.includes("admin") && !rolesSolicitante.includes("ejecutivoAdmin")) {
    throw new HttpsError("permission-denied", "No autorizado.");
  }

  // Estado actual en Auth
  const userAuthAntes = await admin.auth().getUser(String(uid));
  const emailAnterior = (userAuthAntes.email ?? "").toLowerCase();

  if (emailAnterior === email) {
    // nada que hacer, pero respondemos ok
    return { ok: true, emailAnterior, emailNuevo: email };
  }

  try {
    // 1) Auth
    await admin.auth().updateUser(String(uid), {
      email,
      emailVerified: false, // recomendado
    });

    // 2) Firestore (usuarios)
    await admin.firestore().doc(`usuarios/${uid}`).set(
      {
        email,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // (Opcional) Auditoría
    await admin.firestore().collection("auditLogs").add({
      type: "CHANGE_USER_EMAIL",
      targetUid: String(uid),
      oldEmail: emailAnterior,
      newEmail: email,
      byUid: authCtx.uid,
      at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { ok: true, emailAnterior, emailNuevo: email };
  } catch (e: any) {
    // rollback Auth si Firestore falla
    try {
      await admin.auth().updateUser(String(uid), { email: emailAnterior });
    } catch {
      // log interno si quieres
    }
    throw new HttpsError("internal", e?.message ?? "No se pudo cambiar el correo.");
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


