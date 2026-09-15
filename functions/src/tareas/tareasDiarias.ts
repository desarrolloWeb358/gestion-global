// Recordatorio de tareas abiertas, de lunes a sabado a las 8:00 a. m.
//
// DIFERENCIA DE FONDO CON agendaDiaria: la agenda manda EL MISMO texto a todo
// el mundo (la agenda completa del equipo). Aqui cada persona recibe SU propio
// conteo, asi que el mensaje se arma por destinatario y a quien no tenga nada
// abierto no se le escribe. Un "tienes 0 tareas" diario es la forma mas rapida
// de que la gente deje de leer el recordatorio.
//
// LIMITACION DE PLATAFORMA (heredada del modulo de calendario): el valor de un
// parametro de plantilla de Meta no admite saltos de linea, tabulaciones ni
// espacios dobles. Por eso el desglose viaja como UNA frase corrida en el
// parametro `descripcion`; el detalle tarea por tarea sale solo por correo.

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  GMAIL_USER,
  sendEmail,
} from "../notificaciones/sendEmail";
import { callMetaTemplateApi, normalizePhone, sanitizeParameterValue } from "../whatsapp/metaApi";

const ZONA = "America/Bogota";
const DOC_CONFIG = "configuracion/tareas";

const APP_BASE_URL = "https://gestionglobal-9eac8.web.app";
const RUTA_TAREAS = "/tareas";

/** Colombia es UTC-5 fijo y sin horario de verano. */
const OFFSET_COLOMBIA_MS = 5 * 60 * 60 * 1000;

/** Lo que cuenta como tarea abierta. `finalizada` queda fuera. */
const ESTADOS_ABIERTOS = ["pendiente", "en_curso"] as const;

interface ConfigTareasDiarias {
  activa?: boolean;
  /**
   * "conTareas" = cualquiera que tenga al menos una tarea abierta.
   * "seleccion" = solo los uids de la lista, y aun asi solo si tienen tareas.
   */
  destinatarios?: "conTareas" | "seleccion";
  destinatariosUids?: string[];
  canalEmail?: boolean;
  canalWhatsapp?: boolean;
}

interface ConfigTareas {
  whatsappActivo?: boolean;
  numberId?: string | null;
  /** Plantilla de Meta con los parametros `nombre` y `descripcion`. */
  plantillaTareas?: string;
  tareasDiarias?: ConfigTareasDiarias;
}

/** Una tarea abierta, con lo justo para contarla y listarla en el correo. */
interface TareaAbierta {
  titulo: string;
  estado: string;
  prioridad: string;
  fechaLimite: Date | null;
  vencida: boolean;
}

/** El acumulado de una persona. */
interface ResumenPersona {
  uid: string;
  porEmpezar: number;
  enCurso: number;
  vencidas: number;
  tareas: TareaAbierta[];
}

/** Contacto resuelto desde usuarios/{uid}. */
interface Destinatario {
  uid: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
}

// =====================================================
// Lectura y agrupacion
// =====================================================

/**
 * Una sola consulta a `tareas` y el agrupado en memoria. Es mas barato que una
 * consulta por persona y no necesita indice compuesto: `estado in [...]` se
 * resuelve con el indice de campo simple que Firestore crea solo.
 */
async function resumenPorPersona(
  db: admin.firestore.Firestore,
  finDeHoy: Date
): Promise<Map<string, ResumenPersona>> {
  const snap = await db
    .collection("tareas")
    .where("estado", "in", [...ESTADOS_ABIERTOS])
    .get();

  const porUid = new Map<string, ResumenPersona>();

  for (const doc of snap.docs) {
    const data = doc.data();
    const uid: string = (data?.asignadoA ?? "").trim();
    // Una tarea sin asignado no es de nadie: no hay a quien recordarsela.
    if (!uid) continue;

    const estado: string = data?.estado ?? "pendiente";
    const fechaLimite: Date | null = data?.fechaLimite?.toDate?.() ?? null;
    // Vencida = su fecha limite quedo antes del cierre de hoy. Se compara con el
    // fin del dia y no con "ahora" para que una tarea que vence hoy a las 5 p. m.
    // no salga como vencida en el correo de las 8 a. m.
    const vencida = fechaLimite !== null && fechaLimite.getTime() < finDeHoy.getTime();

    const actual =
      porUid.get(uid) ??
      { uid, porEmpezar: 0, enCurso: 0, vencidas: 0, tareas: [] };

    if (estado === "en_curso") actual.enCurso++;
    else actual.porEmpezar++;
    if (vencida) actual.vencidas++;

    actual.tareas.push({
      titulo: (data?.titulo ?? "Tarea sin titulo").trim(),
      estado,
      prioridad: data?.prioridad ?? "media",
      fechaLimite,
      vencida,
    });

    porUid.set(uid, actual);
  }

  return porUid;
}

/** Fin del dia de hoy en hora de Colombia, como instante UTC. */
function finDelDiaColombia(ahora: Date): Date {
  // Restar el offset deja una fecha cuyos campos UTC son la hora de pared en
  // Colombia; se opera con metodos UTC para no depender de la zona del proceso.
  const enColombia = new Date(ahora.getTime() - OFFSET_COLOMBIA_MS);
  enColombia.setUTCHours(23, 59, 59, 999);
  return new Date(enColombia.getTime() + OFFSET_COLOMBIA_MS);
}

/**
 * Resuelve los uids con tareas a contactos reales. Los datos de contacto viven
 * en usuarios/{uid}; la tarea solo guarda el uid y un nombre de cortesia.
 */
async function resolverDestinatarios(
  db: admin.firestore.Firestore,
  uids: string[]
): Promise<Destinatario[]> {
  if (uids.length === 0) return [];

  const refs = uids.map((uid) => db.doc(`usuarios/${uid}`));
  const snaps = await db.getAll(...refs);

  return snaps
    .filter((snap) => snap.exists && snap.data()?.activo !== false)
    .map((snap) => {
      const datos = snap.data();
      return {
        uid: snap.id,
        nombre: primerNombre(datos?.nombre) || datos?.email || "Companero",
        email: (datos?.email ?? "").trim() || null,
        telefono: normalizarTelefono(datos?.telefonoUsuario),
      };
    });
}

/**
 * El saludo suena natural con el primer nombre: "Hola Iveth Andrea Hurtado
 * Molina" parece una notificacion de banco.
 */
function primerNombre(nombre?: string): string {
  return String(nombre ?? "").trim().split(/\s+/)[0] ?? "";
}

/** Version minima de normalizeToE164 del frontend, para Colombia. */
function normalizarTelefono(input?: string): string | null {
  if (!input) return null;
  const digitos = String(input).replace(/\D/g, "");
  if (digitos.length === 10) return `57${digitos}`;
  if (digitos.length === 12 && digitos.startsWith("57")) return digitos;
  if (digitos.length >= 11 && digitos.length <= 15) return digitos;
  return null;
}

// =====================================================
// Redaccion del mensaje
// =====================================================

function cuenta(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * La frase que entra en el parametro `descripcion` de la plantilla. La arma el
 * backend a proposito: asi se cambia el texto sin volver a pasar por la
 * aprobacion de Meta. El cuerpo aprobado es
 * "Hola {{nombre}}, {{descripcion}} Entra al tablero...".
 */
export function frasePendientes(porEmpezar: number, enCurso: number): string {
  const total = porEmpezar + enCurso;
  const cierre = `Recuerda ${total === 1 ? "terminarla" : "terminarlas"} para no atrasarte.`;

  if (porEmpezar > 0 && enCurso > 0) {
    // Con ambos grupos el total siempre es 2 o mas, pero cada parte puede ser 1.
    return (
      `tienes ${cuenta(total, "tarea", "tareas")} por gestionar: ` +
      `${cuenta(porEmpezar, "pendiente", "pendientes")} y ${enCurso} en curso. ${cierre}`
    );
  }

  if (enCurso > 0) {
    return `tienes ${cuenta(enCurso, "tarea", "tareas")} en curso. ${cierre}`;
  }

  return `tienes ${cuenta(porEmpezar, "tarea pendiente", "tareas pendientes")}. ${cierre}`;
}

// =====================================================
// Correo
// =====================================================

const ETIQUETA_PRIORIDAD: Record<string, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

function fechaCorta(fecha: Date): string {
  return fecha.toLocaleDateString("es-CO", {
    timeZone: ZONA,
    day: "numeric",
    month: "long",
  });
}

/** Abiertas primero por vencimiento, luego por prioridad: es el orden en que conviene atacarlas. */
function ordenarParaCorreo(tareas: TareaAbierta[]): TareaAbierta[] {
  const peso: Record<string, number> = { alta: 0, media: 1, baja: 2 };
  return [...tareas].sort((a, b) => {
    if (a.vencida !== b.vencida) return a.vencida ? -1 : 1;
    const limiteA = a.fechaLimite?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const limiteB = b.fechaLimite?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (limiteA !== limiteB) return limiteA - limiteB;
    return (peso[a.prioridad] ?? 1) - (peso[b.prioridad] ?? 1);
  });
}

function detalleTarea(t: TareaAbierta): string {
  const partes = [t.estado === "en_curso" ? "en curso" : "pendiente"];
  partes.push(`prioridad ${ETIQUETA_PRIORIDAD[t.prioridad] ?? t.prioridad}`);
  if (t.fechaLimite) {
    partes.push(t.vencida ? `VENCIO el ${fechaCorta(t.fechaLimite)}` : `vence el ${fechaCorta(t.fechaLimite)}`);
  }
  return partes.join(", ");
}

function cuerpoTextoPlano(nombre: string, resumen: ResumenPersona): string {
  const lineas = ordenarParaCorreo(resumen.tareas).map(
    (t) => `* ${t.titulo} (${detalleTarea(t)})`
  );
  return [
    `Hola ${nombre},`,
    "",
    frasePendientes(resumen.porEmpezar, resumen.enCurso),
    "",
    "TUS TAREAS ABIERTAS",
    ...lineas,
    "",
    `Ver el tablero: ${APP_BASE_URL}${RUTA_TAREAS}`,
  ].join("\n");
}

function cuerpoHtml(nombre: string, resumen: ResumenPersona): string {
  const items = ordenarParaCorreo(resumen.tareas)
    .map(
      (t) => `
        <li style="margin-bottom:10px;font-size:14px;color:#374151;line-height:1.5;">
          <strong style="color:#111827;">${escapar(t.titulo)}</strong><br/>
          <span style="font-size:12px;color:${t.vencida ? "#b91c1c" : "#6b7280"};">
            ${escapar(detalleTarea(t))}
          </span>
        </li>`
    )
    .join("");

  const avisoVencidas =
    resumen.vencidas > 0
      ? `<p style="margin:0 0 16px;padding:10px 12px;border-radius:6px;background:#fef2f2;color:#b91c1c;font-size:13px;">
           ${cuenta(resumen.vencidas, "tarea", "tareas")} ya ${
             resumen.vencidas === 1 ? "paso" : "pasaron"
           } su fecha limite.
         </p>`
      : "";

  return `
    <!doctype html>
    <html lang="es">
    <head><meta charset="utf-8"/><title>Tus tareas pendientes</title></head>
    <body style="margin:0;padding:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 10px 15px rgba(0,0,0,0.05);">
            <tr><td style="background:#111827;color:#f9fafb;padding:16px 24px;">
              <h1 style="margin:0;font-size:20px;">Gestion Global</h1>
              <p style="margin:4px 0 0;font-size:13px;opacity:.8;">Tus tareas pendientes</p>
            </td></tr>
            <tr><td style="padding:24px;">
              <p style="margin:0 0 16px;font-size:15px;color:#111827;">
                Hola ${escapar(nombre)}, ${escapar(
                  frasePendientes(resumen.porEmpezar, resumen.enCurso)
                )}
              </p>
              ${avisoVencidas}
              <h2 style="margin:0 0 12px;font-size:15px;color:#111827;letter-spacing:.3px;">
                TUS TAREAS ABIERTAS
              </h2>
              <ul style="margin:0;padding-left:20px;">${items}</ul>
              <p style="margin-top:24px;">
                <a href="${APP_BASE_URL}${RUTA_TAREAS}"
                   style="display:inline-block;background:#111827;color:#f9fafb;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;">
                  Ver mis tareas
                </a>
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

/** Los titulos los escribe el usuario: pueden traer <, > o &. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// =====================================================
// Funcion programada
// =====================================================

export const tareasDiarias = onSchedule(
  {
    // 8:00 a. m. de lunes a sabado. El domingo es el unico dia sin recordatorio.
    schedule: "0 8 * * 1-6",
    timeZone: ZONA,
    region: "us-central1",
    secrets: [GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN],
  },
  async () => {
    const db = admin.firestore();

    const snapConfig = await db.doc(DOC_CONFIG).get();
    const config = (snapConfig.exists ? snapConfig.data() : {}) as ConfigTareas;
    const ajustes = config.tareasDiarias ?? {};

    // Opt-in explicito. Si el documento de configuracion todavia no existe,
    // `activa` llega undefined: sin esta guarda el envio se dispararia contra
    // todo el que tenga tareas, porque el resto de los valores por defecto
    // (destinatarios "conTareas" + correo) son los permisivos.
    if (ajustes.activa !== true) {
      logger.info(
        "[tareasDiarias] No esta activada. Enciendela en Ajustes > Tareas diarias."
      );
      return;
    }

    const porUid = await resumenPorPersona(db, finDelDiaColombia(new Date()));
    if (porUid.size === 0) {
      logger.info("[tareasDiarias] Nadie tiene tareas abiertas, no se envia nada");
      return;
    }

    // La seleccion es un FILTRO sobre quien tiene tareas, no una lista de envio:
    // a quien esta en la lista pero no tiene nada abierto no se le escribe.
    const conTareas = [...porUid.keys()];
    const uids =
      ajustes.destinatarios === "seleccion"
        ? conTareas.filter((uid) => (ajustes.destinatariosUids ?? []).includes(uid))
        : conTareas;

    if (uids.length === 0) {
      logger.info("[tareasDiarias] Ningun destinatario configurado tiene tareas abiertas", {
        conTareas: conTareas.length,
      });
      return;
    }

    const destinatarios = await resolverDestinatarios(db, uids);
    if (destinatarios.length === 0) {
      logger.warn("[tareasDiarias] Los uids con tareas no resuelven a usuarios activos", {
        uids,
      });
      return;
    }

    // ── Canal WhatsApp: se resuelve la linea una sola vez para todo el lote ──
    let numberData: { phoneNumberId: string; metaToken: string } | null = null;
    let omitidoWa: string | undefined;
    const plantilla = config.plantillaTareas;

    if (ajustes.canalWhatsapp !== true) omitidoWa = "Canal WhatsApp apagado";
    else if (config.whatsappActivo === false) omitidoWa = "WhatsApp desactivado";
    else if (!config.numberId) omitidoWa = "Falta numberId";
    else if (!plantilla) omitidoWa = "Falta plantillaTareas";
    else {
      const numberSnap = await db.doc(`numbers/${config.numberId}`).get();
      if (!numberSnap.exists) omitidoWa = `numbers/${config.numberId} no existe`;
      else numberData = numberSnap.data() as { phoneNumberId: string; metaToken: string };
    }

    let correosEnviados = 0;
    let whatsappEnviados = 0;
    const sinContacto: string[] = [];

    for (const destinatario of destinatarios) {
      const resumen = porUid.get(destinatario.uid);
      if (!resumen) continue;

      if (!destinatario.email && !destinatario.telefono) {
        sinContacto.push(destinatario.uid);
        continue;
      }

      if (ajustes.canalEmail !== false && destinatario.email) {
        try {
          await sendEmail({
            to: destinatario.email,
            subject: `Tienes ${cuenta(
              resumen.porEmpezar + resumen.enCurso,
              "tarea pendiente",
              "tareas pendientes"
            )}`,
            text: cuerpoTextoPlano(destinatario.nombre, resumen),
            html: cuerpoHtml(destinatario.nombre, resumen),
            remitente: "agenda",
          });
          correosEnviados++;
        } catch (err: any) {
          logger.error("[tareasDiarias] Fallo el envio por correo", {
            uid: destinatario.uid,
            error: err?.message ?? String(err),
          });
        }
      }

      if (numberData && plantilla && destinatario.telefono) {
        try {
          await callMetaTemplateApi(
            numberData.phoneNumberId,
            numberData.metaToken,
            normalizePhone(destinatario.telefono),
            plantilla,
            [
              { parameterName: "nombre", value: sanitizeParameterValue(destinatario.nombre) },
              {
                parameterName: "descripcion",
                value: sanitizeParameterValue(
                  frasePendientes(resumen.porEmpezar, resumen.enCurso)
                ),
              },
            ]
          );
          whatsappEnviados++;
        } catch (err: any) {
          logger.error("[tareasDiarias] Fallo el envio por WhatsApp", {
            uid: destinatario.uid,
            error: err?.message ?? String(err),
          });
        }
      }
    }

    logger.info("[tareasDiarias] Recordatorio enviado", {
      personasConTareas: porUid.size,
      destinatarios: destinatarios.length,
      correosEnviados,
      whatsappEnviados,
      whatsappOmitido: omitidoWa,
      sinContacto,
    });
  }
);
