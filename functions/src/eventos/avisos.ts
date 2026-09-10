// Transporte de los avisos del calendario. Lo usan dos productores distintos:
//   · sincronizarEvento  → invitacion / reprogramacion / cancelacion (inmediato)
//   · barrerRecordatorios → recordatorio programado (desde la cola)
// Por eso vive aparte: la logica de "como se ve y por donde sale un aviso" es la
// misma, cambia solo el disparador.

import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { sendEmail } from "../notificaciones/sendEmail";
import { callMetaTemplateApi, normalizePhone, sanitizeParameterValue } from "../whatsapp/metaApi";

export const APP_BASE_URL = "https://gestionglobal-9eac8.web.app";
export const RUTA_CALENDARIO = "/calendario";
const ZONA = "America/Bogota";

/** Documento de configuracion del modulo: configuracion/eventos */
const DOC_CONFIG = "configuracion/eventos";

export type TipoAviso =
  | "invitacion"
  | "recordatorio"
  | "reprogramacion"
  | "cancelacion"
  | "inasistencia";

export interface OpcionesAviso {
  /** Recordatorios: con cuanta antelacion sale el aviso. */
  minutosAntes?: number;
  /** Inasistencia: quien aviso que no podra ir. */
  quienFalta?: string;
  /** Inasistencia: el motivo, si lo dio. */
  motivo?: string;
}

export type CanalAviso = "app" | "email" | "whatsapp";

export interface ParticipanteAviso {
  uid: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
}

export interface EventoAviso {
  id: string;
  titulo: string;
  descripcion?: string;
  modalidad: "presencial" | "virtual" | "hibrida";
  ubicacion?: string;
  enlaceReunion?: string;
  inicio: Date;
  fin: Date;
  todoElDia: boolean;
  /** false = la hora final es implicita y no se menciona en los avisos. */
  tieneHoraFin: boolean;
  organizadorNombre?: string;
}

/** `ok:false` con `omitido:true` significa "no hay nada que reintentar". */
export interface ResultadoAviso {
  ok: boolean;
  omitido?: boolean;
  motivo?: string;
}

// =====================================================
// Formato de fechas (siempre en hora de Colombia)
// =====================================================

export function fechaLarga(fecha: Date): string {
  return fecha.toLocaleDateString("es-CO", {
    timeZone: ZONA,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function fechaCorta(fecha: Date): string {
  return fecha.toLocaleDateString("es-CO", {
    timeZone: ZONA,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function hora(fecha: Date): string {
  return fecha.toLocaleTimeString("es-CO", {
    timeZone: ZONA,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function rangoHorario(evento: EventoAviso): string {
  if (evento.todoElDia) return "Todo el dia";
  if (!evento.tieneHoraFin) return hora(evento.inicio);
  return `${hora(evento.inicio)} - ${hora(evento.fin)}`;
}

/** Donde ocurre: direccion, enlace, o ambos si es hibrida. */
export function lugarTexto(evento: EventoAviso): string {
  const partes: string[] = [];
  if (evento.modalidad !== "virtual" && evento.ubicacion) partes.push(evento.ubicacion);
  if (evento.modalidad !== "presencial" && evento.enlaceReunion) partes.push(evento.enlaceReunion);
  return partes.join(" | ") || "Por confirmar";
}

export function etiquetaAntelacion(minutos: number): string {
  if (minutos % 10080 === 0) return `${minutos / 10080} semana(s) antes`;
  if (minutos % 1440 === 0) return `${minutos / 1440} dia(s) antes`;
  if (minutos % 60 === 0) return `${minutos / 60} hora(s) antes`;
  return `${minutos} minutos antes`;
}

// =====================================================
// Textos por tipo de aviso
// =====================================================

interface Copy {
  asunto: string;
  titulo: string;
  entradilla: string;
}

function copyDeAviso(tipo: TipoAviso, evento: EventoAviso): Copy {
  switch (tipo) {
    case "invitacion":
      return {
        asunto: `[Agenda] ${evento.titulo} - ${fechaCorta(evento.inicio)}`,
        titulo: "Tienes un evento agendado",
        entradilla:
          "Quedaste agendado en este evento. No tienes que confirmar nada; " +
          "si no puedes asistir, avisalo desde el calendario.",
      };
    case "reprogramacion":
      return {
        asunto: `[Reprogramado] ${evento.titulo} - ${fechaCorta(evento.inicio)}`,
        titulo: "Un evento cambio de horario",
        entradilla: "Toma nota: el evento quedo programado para una nueva fecha u hora.",
      };
    case "cancelacion":
      return {
        asunto: `[Cancelado] ${evento.titulo} - ${fechaCorta(evento.inicio)}`,
        titulo: "Se cancelo un evento",
        entradilla: "Este evento ya no se realizara. No necesitas hacer nada.",
      };
    case "inasistencia":
      return {
        asunto: `[No asiste] ${evento.titulo} - ${fechaCorta(evento.inicio)}`,
        titulo: "Alguien no podra asistir",
        entradilla: "Un asistente aviso que no podra estar en este evento.",
      };
    case "recordatorio":
    default:
      return {
        asunto: `[Recordatorio] ${evento.titulo} - ${hora(evento.inicio)}`,
        titulo: "Recordatorio de evento",
        entradilla: "Te recordamos que tienes un evento proximo.",
      };
  }
}

/** Texto corto para la campanita de la app. */
function descripcionApp(
  tipo: TipoAviso,
  evento: EventoAviso,
  opciones: OpcionesAviso = {}
): string {
  const cuando = `${fechaCorta(evento.inicio)} ${evento.todoElDia ? "" : hora(evento.inicio)}`.trim();
  const { minutosAntes, quienFalta, motivo } = opciones;
  switch (tipo) {
    case "invitacion":
      return `Quedaste agendado en "${evento.titulo}" el ${cuando}.`;
    case "inasistencia":
      return `${quienFalta ?? "Un asistente"} no podra asistir a "${evento.titulo}" del ${cuando}.` +
        (motivo ? ` Motivo: ${motivo}` : "");
    case "reprogramacion":
      return `"${evento.titulo}" se reprogramo para el ${cuando}.`;
    case "cancelacion":
      return `Se cancelo "${evento.titulo}" del ${cuando}.`;
    case "recordatorio":
    default:
      return minutosAntes
        ? `Recordatorio (${etiquetaAntelacion(minutosAntes)}): "${evento.titulo}" el ${cuando}.`
        : `Recordatorio: "${evento.titulo}" el ${cuando}.`;
  }
}

// =====================================================
// Canal: alerta en la app
// =====================================================

export async function avisoApp(
  participante: ParticipanteAviso,
  evento: EventoAviso,
  tipo: TipoAviso,
  opciones: OpcionesAviso = {}
): Promise<ResultadoAviso> {
  const db = admin.firestore();
  await db.collection(`usuarios/${participante.uid}/notificaciones`).add({
    descripcion: descripcionApp(tipo, evento, opciones),
    ruta: `${RUTA_CALENDARIO}?evento=${evento.id}`,
    modulo: "evento",
    visto: false,
    fecha: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true };
}

// =====================================================
// Canal: correo
// =====================================================

function plantillaCorreo(params: {
  nombreDestinatario: string;
  copy: Copy;
  evento: EventoAviso;
  tipo: TipoAviso;
  opciones: OpcionesAviso;
}): string {
  const { nombreDestinatario, copy, evento, tipo, opciones } = params;
  const { minutosAntes, quienFalta, motivo } = opciones;
  const cancelado = tipo === "cancelacion";
  const colorAcento = cancelado ? "#dc2626" : "#111827";
  const enlaceApp = `${APP_BASE_URL}${RUTA_CALENDARIO}?evento=${evento.id}`;

  const filas: Array<[string, string]> = [
    ["Fecha", fechaLarga(evento.inicio)],
    ["Hora", rangoHorario(evento)],
    ["Modalidad", evento.modalidad === "hibrida" ? "Hibrida" : evento.modalidad],
    [evento.modalidad === "virtual" ? "Enlace" : "Lugar", lugarTexto(evento)],
  ];
  if (evento.organizadorNombre) filas.push(["Agendo", evento.organizadorNombre]);
  if (minutosAntes) filas.push(["Aviso", etiquetaAntelacion(minutosAntes)]);
  if (tipo === "inasistencia" && quienFalta) {
    filas.push(["No asiste", quienFalta]);
    if (motivo) filas.push(["Motivo", motivo]);
  }

  const filasHtml = filas
    .map(
      ([etiqueta, valor], i) => `
        <tr${i % 2 === 1 ? ' style="background:#f9fafb;"' : ""}>
          <td style="padding:6px;font-weight:bold;color:#374151;white-space:nowrap;">${etiqueta}:</td>
          <td style="padding:6px;">${valor}</td>
        </tr>`
    )
    .join("");

  const bloqueDescripcion = evento.descripcion
    ? `<p style="margin-top:16px;white-space:pre-wrap;">${evento.descripcion}</p>`
    : "";

  const botonUnirse =
    !cancelado && evento.modalidad !== "presencial" && evento.enlaceReunion
      ? `<a href="${evento.enlaceReunion}" style="display:inline-block;background:#059669;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;margin-right:8px;">Unirse a la reunion</a>`
      : "";

  return `
    <!doctype html>
    <html lang="es">
    <head><meta charset="utf-8"/><title>${copy.asunto}</title></head>
    <body style="margin:0;padding:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 10px 15px rgba(0,0,0,0.05);">
            <tr><td style="background:#111827;color:#f9fafb;padding:16px 24px;">
              <h1 style="margin:0;font-size:20px;">Gestion Global</h1>
              <p style="margin:4px 0 0;font-size:13px;opacity:.8;">Agenda del equipo</p>
            </td></tr>
            <tr><td style="padding:24px;">
              <p style="margin-top:0;font-size:14px;">Hola <strong>${nombreDestinatario}</strong>,</p>
              <h2 style="margin:0 0 8px;font-size:18px;color:${colorAcento};${cancelado ? "" : ""}">${copy.titulo}</h2>
              <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">${copy.entradilla}</p>

              <p style="font-size:16px;font-weight:bold;color:${colorAcento};margin:0 0 12px;${cancelado ? "text-decoration:line-through;" : ""}">
                ${evento.titulo}
              </p>

              <table style="border-collapse:collapse;width:100%;font-size:14px;">${filasHtml}</table>
              ${bloqueDescripcion}

              <p style="margin-top:24px;">
                ${botonUnirse}
                <a href="${enlaceApp}" style="display:inline-block;background:#111827;color:#f9fafb;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;">
                  Ver en el calendario
                </a>
              </p>

              <p style="margin-top:24px;font-size:12px;color:#6b7280;">
                Este es un aviso automatico de la agenda. Puedes confirmar o rechazar tu
                asistencia desde el calendario en la plataforma.
              </p>
            </td></tr>
            <tr><td style="background:#f9fafb;padding:16px 24px;text-align:center;font-size:11px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} Gestion Global. Todos los derechos reservados.
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

export async function avisoEmail(
  participante: ParticipanteAviso,
  evento: EventoAviso,
  tipo: TipoAviso,
  opciones: OpcionesAviso = {}
): Promise<ResultadoAviso> {
  if (!participante.email) {
    return { ok: false, omitido: true, motivo: "El participante no tiene correo registrado" };
  }

  const copy = copyDeAviso(tipo, evento);
  const html = plantillaCorreo({
    nombreDestinatario: participante.nombre,
    copy,
    evento,
    tipo,
    opciones,
  });

  const texto = [
    `Hola ${participante.nombre},`,
    "",
    copy.titulo,
    copy.entradilla,
    "",
    evento.titulo,
    `Fecha: ${fechaLarga(evento.inicio)}`,
    `Hora: ${rangoHorario(evento)}`,
    `Lugar: ${lugarTexto(evento)}`,
    "",
    `Ver en el calendario: ${APP_BASE_URL}${RUTA_CALENDARIO}?evento=${evento.id}`,
    "",
    "--",
    "Gestion Global",
  ].join("\n");

  await sendEmail({ to: participante.email, subject: copy.asunto, text: texto, html, remitente: "agenda" });
  return { ok: true };
}

// =====================================================
// Canal: WhatsApp (plantilla de utilidad de Meta)
// =====================================================

interface ConfigEventos {
  numberId?: string;
  plantillaRecordatorio?: string;
  whatsappActivo?: boolean;
}

let configCache: { valor: ConfigEventos; expiraEn: number } | null = null;

/**
 * La configuracion cambia muy de vez en cuando y el scheduler la pediria en cada
 * barrido: se cachea un minuto dentro de la misma instancia.
 */
async function leerConfig(): Promise<ConfigEventos> {
  if (configCache && configCache.expiraEn > Date.now()) return configCache.valor;

  const snap = await admin.firestore().doc(DOC_CONFIG).get();
  const valor = (snap.exists ? snap.data() : {}) as ConfigEventos;
  configCache = { valor, expiraEn: Date.now() + 60_000 };
  return valor;
}

/**
 * Solo hay una plantilla aprobada en Meta y su texto esta redactado como
 * recordatorio. Para que un aviso de cancelacion no diga "te recordamos tu
 * proximo evento", el tipo se antepone al titulo dentro del parametro.
 */
function tituloSegunTipo(tipo: TipoAviso, titulo: string): string {
  switch (tipo) {
    case "cancelacion":
      return `CANCELADO - ${titulo}`;
    case "reprogramacion":
      return `REPROGRAMADO - ${titulo}`;
    case "invitacion":
      return `AGENDADO - ${titulo}`;
    case "inasistencia":
      return `CAMBIO DE ASISTENCIA - ${titulo}`;
    case "recordatorio":
    default:
      return titulo;
  }
}

export async function avisoWhatsapp(
  participante: ParticipanteAviso,
  evento: EventoAviso,
  tipo: TipoAviso,
  _opciones: OpcionesAviso = {}
): Promise<ResultadoAviso> {
  if (!participante.telefono) {
    return { ok: false, omitido: true, motivo: "El participante no tiene telefono registrado" };
  }

  const config = await leerConfig();
  if (config.whatsappActivo === false) {
    return { ok: false, omitido: true, motivo: "Canal WhatsApp desactivado en configuracion/eventos" };
  }
  if (!config.numberId || !config.plantillaRecordatorio) {
    return {
      ok: false,
      omitido: true,
      motivo: "Falta configurar numberId y plantillaRecordatorio en configuracion/eventos",
    };
  }

  const numberSnap = await admin.firestore().doc(`numbers/${config.numberId}`).get();
  if (!numberSnap.exists) {
    return { ok: false, omitido: true, motivo: `El numero ${config.numberId} no existe` };
  }
  const numberData = numberSnap.data() as { phoneNumberId: string; metaToken: string };

  // Los nombres de parametro deben coincidir con la plantilla aprobada en Meta.
  const parametros = [
    { parameterName: "nombre", value: participante.nombre },
    { parameterName: "evento", value: tituloSegunTipo(tipo, evento.titulo) },
    { parameterName: "fecha", value: fechaLarga(evento.inicio) },
    { parameterName: "hora", value: rangoHorario(evento) },
    { parameterName: "lugar", value: lugarTexto(evento) },
  ].map((p) => ({ ...p, value: sanitizeParameterValue(p.value) }));

  // A diferencia del modulo de cobranza, aqui NO se llama a appendMessage: son
  // avisos internos al equipo y ensuciarian la bandeja de conversaciones.
  await callMetaTemplateApi(
    numberData.phoneNumberId,
    numberData.metaToken,
    normalizePhone(participante.telefono),
    config.plantillaRecordatorio,
    parametros
  );

  return { ok: true };
}

// =====================================================
// Despachador
// =====================================================

export async function enviarAviso(
  canal: CanalAviso,
  participante: ParticipanteAviso,
  evento: EventoAviso,
  tipo: TipoAviso,
  opciones: OpcionesAviso = {}
): Promise<ResultadoAviso> {
  try {
    switch (canal) {
      case "app":
        return await avisoApp(participante, evento, tipo, opciones);
      case "email":
        return await avisoEmail(participante, evento, tipo, opciones);
      case "whatsapp":
        return await avisoWhatsapp(participante, evento, tipo, opciones);
      default:
        return { ok: false, omitido: true, motivo: `Canal desconocido: ${canal}` };
    }
  } catch (err: any) {
    logger.error("[enviarAviso] Fallo el envio", {
      canal,
      tipo,
      eventoId: evento.id,
      participanteUid: participante.uid,
      error: err?.message ?? String(err),
    });
    return { ok: false, motivo: err?.message ?? String(err) };
  }
}

/** Normaliza el documento de Firestore al shape que usan los avisos. */
export function eventoDesdeDoc(id: string, data: any): EventoAviso {
  return {
    id,
    titulo: data.titulo ?? "Evento",
    descripcion: data.descripcion ?? "",
    modalidad: data.modalidad ?? "presencial",
    ubicacion: data.ubicacion ?? "",
    enlaceReunion: data.enlaceReunion ?? "",
    inicio: data.inicio?.toDate?.() ?? new Date(),
    fin: data.fin?.toDate?.() ?? new Date(),
    todoElDia: data.todoElDia === true,
    // Ausente = true: asi se comportaban los eventos previos a esta opcion.
    tieneHoraFin: data.tieneHoraFin !== false,
    organizadorNombre: data.organizadorNombre ?? "",
  };
}
