import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { sendEmail } from "../notificaciones/sendEmail";

/**
 * Piezas compartidas por las Cloud Functions de valores agregados.
 * Antes cada archivo repetía la plantilla HTML y la resolución de destinatarios.
 */

export const MODULO_VALOR_AGREGADO = "valor agregado";

export const APP_BASE_URL = "https://gestionglobal-9eac8.web.app";

const TIPO_LABELS: Record<string, string> = {
  "derecho de peticion": "Derecho de Petición",
  tutela: "Tutela",
  desacato: "Desacato",
  "estudios contratos": "Estudios / Contratos",
  otros: "Otros",
};

export function tipoLabel(tipo: unknown): string {
  const key = String(tipo ?? "");
  return TIPO_LABELS[key] ?? key ?? "Valor agregado";
}

export function rutaValorAgregado(clienteId: string, valorId: string): string {
  return `/clientes/${clienteId}/valores-agregados/${valorId}`;
}

export type Destinatario = {
  usuarioId: string;
  nombre: string;
  correo?: string;
};

export type ClienteInfo = {
  abogadoId?: string;
  correoAbogado?: string;
  nombreAbogado?: string;
  dependienteAbogadoId?: string;
  correoDepAbogado?: string;
  nombreDepAbogado?: string;
  nombreCliente?: string;
  correoCliente?: string;
};

export async function obtenerClienteInfo(
  db: FirebaseFirestore.Firestore,
  clienteId: string
): Promise<ClienteInfo> {
  const cSnap = await db.doc(`clientes/${clienteId}`).get();
  if (!cSnap.exists) return {};

  const cData: any = cSnap.data() || {};
  const abogadoId: string | undefined = cData.abogadoId || undefined;
  const dependienteAbogadoId: string | undefined =
    cData.dependienteAbogadoId || undefined;

  let correoAbogado: string | undefined;
  let nombreAbogado = "Abogado";
  if (abogadoId) {
    const abSnap = await db.doc(`usuarios/${abogadoId}`).get();
    if (abSnap.exists) {
      const abData: any = abSnap.data() || {};
      correoAbogado = abData.email;
      nombreAbogado = abData.nombre || "Abogado";
    }
  }

  let correoDepAbogado: string | undefined;
  let nombreDepAbogado = "Asistente Jurídico";
  if (dependienteAbogadoId) {
    const depSnap = await db.doc(`usuarios/${dependienteAbogadoId}`).get();
    if (depSnap.exists) {
      const depData: any = depSnap.data() || {};
      correoDepAbogado = depData.email;
      nombreDepAbogado = depData.nombre || "Asistente Jurídico";
    }
  }

  // El id del cliente es también el uid de su usuario.
  let correoCliente: string | undefined;
  const uSnap = await db.doc(`usuarios/${clienteId}`).get();
  if (uSnap.exists) correoCliente = (uSnap.data() as any)?.email;

  return {
    abogadoId,
    correoAbogado,
    nombreAbogado,
    dependienteAbogadoId,
    correoDepAbogado,
    nombreDepAbogado,
    nombreCliente: cData.nombre,
    correoCliente,
  };
}

/** Abogado + dependiente del cliente, ya resueltos y sin huecos. */
export function destinatariosJuridica(info: ClienteInfo): Destinatario[] {
  const out: Destinatario[] = [];
  if (info.abogadoId) {
    out.push({
      usuarioId: info.abogadoId,
      nombre: info.nombreAbogado ?? "Abogado",
      correo: info.correoAbogado,
    });
  }
  if (info.dependienteAbogadoId) {
    out.push({
      usuarioId: info.dependienteAbogadoId,
      nombre: info.nombreDepAbogado ?? "Asistente Jurídico",
      correo: info.correoDepAbogado,
    });
  }
  return out;
}

export function destinatarioCliente(
  clienteId: string,
  info: ClienteInfo
): Destinatario {
  return {
    usuarioId: clienteId,
    nombre: info.nombreCliente ?? "Cliente",
    correo: info.correoCliente,
  };
}

export function buildEmailHtml(
  nombreDestinatario: string,
  titulo: string,
  cuerpoHtml: string,
  enlace?: string
): string {
  const boton = enlace
    ? `<p style="margin-top:24px;">
         <a href="${APP_BASE_URL}${enlace}"
            style="display:inline-block;background:#004b87;color:#f9fafb;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;">
           Ver valor agregado →
         </a>
       </p>`
    : "";

  return `
    <!doctype html>
    <html lang="es">
    <head><meta charset="utf-8" /><title>${titulo}</title></head>
    <body style="margin:0;padding:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background-color:#f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 10px 15px rgba(0,0,0,0.05);">
            <tr><td style="background:#111827;color:#f9fafb;padding:16px 24px;">
              <h1 style="margin:0;font-size:20px;">Gestión Global</h1>
              <p style="margin:4px 0 0;font-size:13px;opacity:0.8;">Plataforma de gestión de cartera</p>
            </td></tr>
            <tr><td style="padding:24px;">
              <p style="margin-top:0;margin-bottom:12px;font-size:14px;">Hola <strong>${nombreDestinatario}</strong>,</p>
              <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">${titulo}</h2>
              <div style="font-size:14px;color:#374151;line-height:1.5;">${cuerpoHtml}</div>
              ${boton}
              <p style="margin-top:24px;font-size:12px;color:#6b7280;">
                Si no reconoces esta notificación, por favor comunícate con el equipo de soporte de Gestión Global.
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
}

export type AvisoInput = {
  db: FirebaseFirestore.Firestore;
  destinatarios: Destinatario[];
  ruta: string;
  descripcionAlerta: string;
  subject: string;
  tituloCorreo: string;
  cuerpoHtmlCorreo: string;
  logTag: string;
};

/**
 * Colapsa por `usuarioId`: en muchos clientes el abogado y el dependiente son
 * la misma persona, y sin esto recibía la alerta y el correo dos veces.
 * Entre entradas repetidas gana la que traiga correo.
 */
function unicosPorUsuario(destinatarios: Destinatario[]): Destinatario[] {
  const porUid = new Map<string, Destinatario>();
  for (const d of destinatarios) {
    if (!d.usuarioId) continue;
    const previo = porUid.get(d.usuarioId);
    if (!previo || (!previo.correo && d.correo)) porUid.set(d.usuarioId, d);
  }
  return [...porUid.values()];
}

/**
 * Un solo camino por destinatario: alerta en la app + correo. Antes el
 * dependiente recibía el correo por una función y la alerta por otra distinta.
 * Los fallos se registran pero no tumban al resto de destinatarios.
 */
export async function avisar(input: AvisoInput): Promise<void> {
  const {
    db,
    ruta,
    descripcionAlerta,
    subject,
    tituloCorreo,
    cuerpoHtmlCorreo,
    logTag,
  } = input;

  const destinatarios = unicosPorUsuario(input.destinatarios);

  await Promise.all(
    destinatarios.map(async (d) => {
      try {
        await db.collection(`usuarios/${d.usuarioId}/notificaciones`).add({
          descripcion: descripcionAlerta,
          ruta,
          modulo: MODULO_VALOR_AGREGADO,
          visto: false,
          fecha: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (err) {
        logger.error(`[${logTag}] Error creando alerta para ${d.usuarioId}:`, err);
      }

      if (!d.correo) {
        logger.warn(`[${logTag}] Usuario ${d.usuarioId} sin correo, no se envía email`);
        return;
      }

      try {
        await sendEmail({
          to: d.correo,
          subject,
          text: `${tituloCorreo}\n\n${descripcionAlerta}\n\n${APP_BASE_URL}${ruta}`,
          html: buildEmailHtml(d.nombre, tituloCorreo, cuerpoHtmlCorreo, ruta),
        });
      } catch (err) {
        logger.error(`[${logTag}] Error enviando correo a ${d.usuarioId}:`, err);
      }
    })
  );
}
