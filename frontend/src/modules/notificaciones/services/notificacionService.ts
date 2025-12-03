// src/shared/services/notificationService.ts
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/firebase";
import { sendNotification } from "@/shared/services/sendNotification";
import type { NotificacionAlerta } from "@/modules/notificaciones/models/notificacion.model";
import type { Timestamp } from "firebase/firestore";
import { normalizeToE164 } from "@/shared/phoneUtils";


export type NotificarInput = {
  usuarioId: string;
  modulo: string;         // "valor_agregado", "seguimiento", etc.
  ruta: string;           // a dónde debe ir el usuario en la app
  descripcionAlerta: string;

  // Datos del correo
  subject: string;
  tituloCorreo: string;
  cuerpoHtmlCorreo: string;
  accionUrl?: string;
  accionTexto?: string;
};

type ContactoUsuario = {
  nombre?: string;
  correo?: string;
  whatsapp?: string;
};

type CrearAlertaInput = {
  usuarioId: string;
  descripcion: string;
  ruta: string;
  modulo: string;
  fechaTs?: Timestamp; // opcional; si no viene, serverTimestamp()
};

type EmailTemplateParams = {
  nombreDestinatario: string;
  titulo: string;          // p.ej. "Nuevo valor agregado registrado"
  cuerpoHtml: string;      // contenido principal específico del módulo
  accionUrl?: string;      // opcional: link para "Ver detalle"
  accionTexto?: string;    // texto del botón, p.ej. "Ver en Gestión Global"
};

type EnviarEmailUsuarioInput = {
  usuarioId: string;
  subject: string;
  titulo: string;      // título visible en el cuerpo del correo
  cuerpoHtml: string;  // HTML específico del módulo (sin header/pie)
  accionUrl?: string;
  accionTexto?: string;
};

export async function notificarUsuarioConAlertaYCorreo(
  input: NotificarInput
): Promise<{ alertaId?: string }> {
  const {
    usuarioId,
    modulo,
    ruta,
    descripcionAlerta,
    subject,
    tituloCorreo,
    cuerpoHtmlCorreo,
    accionUrl,
    accionTexto,
  } = input;

  // 1) Crear alerta en Firestore
  let alertaId: string | undefined;
  try {
    alertaId = await crearAlertaNotificacion({
      usuarioId,
      descripcion: descripcionAlerta,
      ruta,
      modulo,
    });
  } catch (err) {
    console.error(
      "[notificarUsuarioConAlertaYCorreo] Error creando alerta:",
      err
    );
  }

  // 2) Enviar email (si tiene correo)
  try {
    await enviarEmailAUsuario({
      usuarioId,
      subject,
      titulo: tituloCorreo,
      cuerpoHtml: cuerpoHtmlCorreo,
      accionUrl,
      accionTexto,
    });
  } catch (err) {
    console.error("[notificarUsuarioConAlertaYCorreo] Error enviando email:", err);
  }

  return { alertaId };
}

async function crearAlertaNotificacion({
  usuarioId,
  descripcion,
  ruta,
  modulo,
  fechaTs,
}: CrearAlertaInput): Promise<string> {
  const colRef = collection(db, `usuarios/${usuarioId}/notificaciones`);
  const payload: Omit<NotificacionAlerta, "id"> = {
    descripcion,
    ruta,
    modulo,
    visto: false,
    fecha: fechaTs ?? (serverTimestamp() as any),
  };

  const created = await addDoc(colRef, payload);
  return created.id;
}

async function obtenerContactoUsuario(usuarioID: string): Promise<ContactoUsuario> {
  const uSnap = await getDoc(doc(db, `usuarios/${usuarioID}`));
  if (!uSnap.exists()) {
    console.warn(`[obtenerContactoUsuario] Usuario ${usuarioID} no existe`);
    return {};
  }

  const uData: any = uSnap.data() || {};
  return {
    nombre: uData.nombre,
    correo: uData.email,
    whatsapp: normalizeToE164(uData.telefonoUsuario, {
      defaultCountry: "CO",
    }),
  };
}


async function enviarEmailAUsuario({
  usuarioId,
  subject,
  titulo,
  cuerpoHtml,
  accionUrl,
  accionTexto,
}: EnviarEmailUsuarioInput): Promise<void> {
  const contacto = await obtenerContactoUsuario(usuarioId);
  if (!contacto.correo) {
    console.warn(
      `[enviarEmailAUsuario] Usuario ${usuarioId} sin correo, no se envía email`
    );
    return;
  }

  const nombreDest = contacto.nombre || "Usuario";

  const html = buildGestionGlobalEmailHtml({
    nombreDestinatario: nombreDest,
    titulo,
    cuerpoHtml,
    accionUrl,
    accionTexto,
  });

  // Para el texto plano quitamos etiquetas simples:
  const plainBody = cuerpoHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .trim();

  const text = buildPlainText(nombreDest, titulo, plainBody, accionUrl);

  await sendNotification({
    to: contacto.correo,
    subject,
    text,
    html,
  });
}

function buildGestionGlobalEmailHtml(params: EmailTemplateParams): string {
  const {
    nombreDestinatario,
    titulo,
    cuerpoHtml,
    accionUrl,
    accionTexto = "Abrir Gestión Global",
  } = params;

  const botonHtml = accionUrl
    ? `
      <p style="text-align:center;margin:24px 0;">
        <a href="${accionUrl}"
           style="background-color:#2563eb;color:#ffffff;padding:12px 24px;
                  border-radius:6px;text-decoration:none;font-weight:600;
                  display:inline-block;">
          ${accionTexto}
        </a>
      </p>
    `
    : "";

  return `
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>${titulo}</title>
    </head>
    <body style="margin:0;padding:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background-color:#f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 10px 15px rgba(0,0,0,0.05);">
              <!-- Encabezado -->
              <tr>
                <td style="background:#111827;color:#f9fafb;padding:16px 24px;">
                  <h1 style="margin:0;font-size:20px;">Gestión Global</h1>
                  <p style="margin:4px 0 0;font-size:13px;opacity:0.8;">
                    Plataforma de gestión de cartera
                  </p>
                </td>
              </tr>

              <!-- Contenido -->
              <tr>
                <td style="padding:24px;">
                  <p style="margin-top:0;margin-bottom:12px;font-size:14px;">
                    Hola <strong>${nombreDestinatario}</strong>,
                  </p>

                  <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">
                    ${titulo}
                  </h2>

                  <div style="font-size:14px;color:#374151;line-height:1.5;">
                    ${cuerpoHtml}
                  </div>

                  ${botonHtml}

                  <p style="margin-top:24px;font-size:12px;color:#6b7280;">
                    Si no reconoces esta notificación, por favor comunícate con el equipo de soporte de Gestión Global.
                  </p>
                </td>
              </tr>

              <!-- Pie -->
              <tr>
                <td style="background:#f9fafb;padding:16px 24px;text-align:center;font-size:11px;color:#9ca3af;">
                  © ${new Date().getFullYear()} Gestión Global. Todos los derechos reservados.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}


function buildPlainText(
  nombreDestinatario: string,
  titulo: string,
  cuerpo: string,
  accionUrl?: string
): string {
  let text = `Hola ${nombreDestinatario},

${titulo}

${cuerpo}
`;

  if (accionUrl) {
    text += `

Ver detalle: ${accionUrl}
`;
  }

  text += `

—
Gestión Global
`;
  return text;
}

export async function marcarNotificacionComoVista(
  usuarioId: string,
  notificacionId: string
) {
  const ref = doc(db, `usuarios/${usuarioId}/notificaciones/${notificacionId}`);
  await updateDoc(ref, { visto: true });
}