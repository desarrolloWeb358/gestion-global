// Resumen de la agenda del dia siguiente, todas las noches a las 8:00 p. m.
//
// LIMITACION DE PLATAFORMA: la API de WhatsApp Cloud de Meta no permite enviar
// mensajes a grupos, solo a numeros individuales. Por eso la agenda sale a una
// lista de destinatarios configurada, no al grupo del equipo.
//
// SEGUNDA LIMITACION (a confirmar en produccion): la documentacion de Meta dice
// que el VALOR de un parametro no admite saltos de linea, aunque el cuerpo de la
// plantilla si. El envio intenta primero con saltos reales y solo aplana si Meta
// los rechaza; el log dice en que modo quedo. Por correo siempre sale completo.

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
import { randomUUID } from "crypto";
import { callMetaTemplateApi, normalizePhone, sanitizeParameterValue } from "../whatsapp/metaApi";
import { generarImagenAgenda, hayTipografia } from "./imagenAgenda";
import { APP_BASE_URL, RUTA_CALENDARIO } from "./avisos";

const ZONA = "America/Bogota";
const DOC_CONFIG = "configuracion/eventos";

/** Tope del parametro de texto de una plantilla de Meta. */
const MAX_CARACTERES_PARAMETRO = 1000;

interface ConfigAgendaDiaria {
  activa?: boolean;
  /** "equipo" = todo el personal interno activo. "seleccion" = solo los uids. */
  destinatarios?: "equipo" | "seleccion";
  destinatariosUids?: string[];
  canalEmail?: boolean;
  canalWhatsapp?: boolean;
  separador?: string;
  /** "imagen" manda la agenda dibujada; "texto" la manda como parrafo. */
  formatoWhatsapp?: "texto" | "imagen";
}

interface ConfigEventos {
  numberId?: string;
  whatsappActivo?: boolean;
  /** Plantilla de solo texto. */
  plantillaAgenda?: string;
  /** Plantilla con encabezado de imagen. */
  plantillaAgendaImagen?: string;
  agendaDiaria?: ConfigAgendaDiaria;
}

/** Cuantos dias se conservan las imagenes generadas en Storage. */
const RETENCION_IMAGENES_DIAS = 30;
const CARPETA_IMAGENES = "agendaDiaria";

/** Contacto resuelto de un destinatario, leido de usuarios/{uid}. */
interface Destinatario {
  uid: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
}

const ROLES_EQUIPO_INTERNO = [
  "admin",
  "supervisor",
  "adminFranquicia",
  "ejecutivoAdmin",
  "ejecutivo",
  "dependiente",
  "abogado",
];

// =====================================================
// Ventana del dia siguiente en hora de Colombia
// =====================================================

/**
 * Colombia es UTC-5 fijo y sin horario de verano, asi que el corte del dia se
 * calcula con un desplazamiento constante.
 */
const OFFSET_COLOMBIA_MS = 5 * 60 * 60 * 1000;

function ventanaMananaColombia(ahora: Date): { desde: Date; hasta: Date; dia: Date } {
  // Restar el offset deja una fecha cuyos campos UTC son la hora de pared en
  // Colombia. Se opera con metodos UTC a proposito: asi el resultado no depende
  // de la zona horaria en la que corra el proceso.
  const enColombia = new Date(ahora.getTime() - OFFSET_COLOMBIA_MS);
  enColombia.setUTCDate(enColombia.getUTCDate() + 1);

  const inicioDia = new Date(enColombia);
  inicioDia.setUTCHours(0, 0, 0, 0);

  const finDia = new Date(enColombia);
  finDia.setUTCHours(23, 59, 59, 999);

  // Sumar el offset de vuelta convierte esa hora de pared al instante UTC real.
  const desde = new Date(inicioDia.getTime() + OFFSET_COLOMBIA_MS);
  return {
    desde,
    hasta: new Date(finDia.getTime() + OFFSET_COLOMBIA_MS),
    dia: desde,
  };
}

/** "LUNES 24 AGOSTO", como se escribe hoy la agenda a mano. */
function encabezadoFecha(dia: Date): string {
  const texto = dia.toLocaleDateString("es-CO", {
    timeZone: ZONA,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  // "lunes, 24 de agosto" → "LUNES 24 AGOSTO"
  return texto.replace(/,/g, "").replace(/ de /g, " ").toUpperCase();
}

function horaCorta(fecha: Date): string {
  return fecha
    .toLocaleTimeString("es-CO", {
      timeZone: ZONA,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/ /g, " ");
}

// =====================================================
// Armado de las lineas
// =====================================================

/**
 * Un evento del dia, con sus partes separadas. Antes era solo una cadena; la
 * imagen necesita el color de la categoria, la hora y los asistentes por aparte
 * para poder maquetarlos.
 */
export interface EventoAgenda {
  inicio: Date;
  hora: string;
  titulo: string;
  quienes: string;
  lugar: string;
  categoria: string;
  descripcion: string;
  /** La linea de una sola cadena, para texto plano y WhatsApp. */
  texto: string;
}

function construirEvento(data: any): EventoAgenda | null {
  const inicio: Date | undefined = data?.inicio?.toDate?.();
  if (!inicio) return null;

  const titulo: string = (data?.titulo ?? "Evento").trim();
  const participantes: any[] = Array.isArray(data?.participantes) ? data.participantes : [];

  const asisten = participantes
    .filter((p) => p?.respuesta !== "rechazo")
    .map((p) => (p?.nombre ?? "").trim())
    .filter(Boolean);

  const quienes = asisten.length > 0 ? asisten.join(", ") : "sin asistente confirmado";
  const todoElDia = data?.todoElDia === true;
  const hora = todoElDia ? "Todo el dia" : horaCorta(inicio);
  const descripcion: string = (data?.descripcion ?? "").trim().replace(/\s+/g, " ");

  const modalidad: string = data?.modalidad ?? "presencial";
  const lugar =
    modalidad === "virtual"
      ? "Virtual"
      : String(data?.ubicacion ?? "").trim();

  const cuando = todoElDia ? "todo el dia" : `a las ${hora}`;
  const partes = [`${titulo} ${cuando} - ${quienes}`];
  if (descripcion) partes.push(`(${descripcion})`);

  return {
    inicio,
    hora,
    titulo,
    quienes,
    lugar,
    categoria: data?.categoria ?? "otro",
    descripcion,
    texto: partes.join(" "),
  };
}

async function eventosDeManana(
  db: admin.firestore.Firestore,
  desde: Date,
  hasta: Date
): Promise<EventoAgenda[]> {
  const snap = await db
    .collection("eventos")
    .where("inicio", ">=", admin.firestore.Timestamp.fromDate(desde))
    .where("inicio", "<=", admin.firestore.Timestamp.fromDate(hasta))
    .orderBy("inicio", "asc")
    .get();

  return snap.docs
    .map((d) => d.data())
    .filter((data) => data?.estado !== "cancelado")
    .map(construirEvento)
    .filter((e): e is EventoAgenda => e !== null);
}

// =====================================================
// Canales
// =====================================================

function cuerpoTextoPlano(encabezado: string, lineas: EventoAgenda[]): string {
  const cuerpo = lineas.map((l) => `* ${l.texto}`).join("\n");
  return `AGENDA ${encabezado}\n\n${cuerpo}`;
}

function cuerpoHtml(encabezado: string, lineas: EventoAgenda[]): string {
  const items = lineas
    .map(
      (l) =>
        `<li style="margin-bottom:8px;font-size:14px;color:#374151;line-height:1.5;">${l.texto}</li>`
    )
    .join("");

  return `
    <!doctype html>
    <html lang="es">
    <head><meta charset="utf-8"/><title>Agenda ${encabezado}</title></head>
    <body style="margin:0;padding:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 10px 15px rgba(0,0,0,0.05);">
            <tr><td style="background:#111827;color:#f9fafb;padding:16px 24px;">
              <h1 style="margin:0;font-size:20px;">Gestion Global</h1>
              <p style="margin:4px 0 0;font-size:13px;opacity:.8;">Agenda del dia siguiente</p>
            </td></tr>
            <tr><td style="padding:24px;">
              <h2 style="margin:0 0 16px;font-size:18px;color:#111827;letter-spacing:.5px;">
                AGENDA ${encabezado}
              </h2>
              <ul style="margin:0;padding-left:20px;">${items}</ul>
              <p style="margin-top:24px;">
                <a href="${APP_BASE_URL}${RUTA_CALENDARIO}"
                   style="display:inline-block;background:#111827;color:#f9fafb;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;">
                  Ver el calendario
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

/**
 * Resuelve los destinatarios a contactos reales. Se eligen usuarios (no correos
 * sueltos) desde Ajustes > Agenda diaria, y aqui se leen su correo y telefono.
 */
async function resolverDestinatarios(
  db: admin.firestore.Firestore,
  agenda: ConfigAgendaDiaria
): Promise<Destinatario[]> {
  const aDestinatario = (uid: string, datos: any): Destinatario => ({
    uid,
    nombre: datos?.nombre || datos?.email || "Companero",
    email: (datos?.email ?? "").trim() || null,
    telefono: normalizarTelefono(datos?.telefonoUsuario),
  });

  if (agenda.destinatarios === "seleccion") {
    const uids = (agenda.destinatariosUids ?? []).filter(Boolean);
    if (uids.length === 0) return [];

    const refs = uids.map((uid) => db.doc(`usuarios/${uid}`));
    const snaps = await db.getAll(...refs);

    return snaps
      .filter((snap) => snap.exists && snap.data()?.activo !== false)
      .map((snap) => aDestinatario(snap.id, snap.data()));
  }

  // "equipo": todo el personal interno activo.
  const snap = await db
    .collection("usuarios")
    .where("roles", "array-contains-any", ROLES_EQUIPO_INTERNO)
    .get();

  return snap.docs
    .filter((d) => d.data()?.activo !== false)
    .map((d) => aDestinatario(d.id, d.data()));
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

/**
 * Sube la imagen a Storage y devuelve una URL que Meta pueda descargar sin
 * autenticacion. Se usa el token de descarga de Firebase en vez de una URL
 * firmada: la firma exige el permiso iam.serviceAccounts.signBlob en la cuenta
 * de servicio, y el token no necesita nada extra y tampoco es adivinable.
 */
async function subirImagen(png: Buffer, encabezado: string): Promise<string> {
  const bucket = admin.storage().bucket();
  const token = randomUUID();
  const nombre = `${CARPETA_IMAGENES}/${Date.now()}-${encabezado
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}.png`;

  const archivo = bucket.file(nombre);
  await archivo.save(png, {
    contentType: "image/png",
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });

  return (
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
    `${encodeURIComponent(nombre)}?alt=media&token=${token}`
  );
}

/** Borra las imagenes viejas para que el bucket no crezca sin control. */
async function purgarImagenes(): Promise<number> {
  try {
    const corte = Date.now() - RETENCION_IMAGENES_DIAS * 24 * 60 * 60 * 1000;
    const [archivos] = await admin
      .storage()
      .bucket()
      .getFiles({ prefix: `${CARPETA_IMAGENES}/` });

    const viejos = archivos.filter((a) => {
      const creado = Date.parse(String(a.metadata?.timeCreated ?? ""));
      return Number.isFinite(creado) && creado < corte;
    });

    await Promise.all(viejos.map((a) => a.delete().catch(() => undefined)));
    return viejos.length;
  } catch (err: any) {
    logger.warn("[agendaDiaria] No se pudieron purgar las imagenes", {
      error: err?.message ?? String(err),
    });
    return 0;
  }
}

async function enviarPorWhatsapp(
  db: admin.firestore.Firestore,
  config: ConfigEventos,
  destinatarios: Destinatario[],
  encabezado: string,
  lineas: EventoAgenda[]
): Promise<{ enviados: number; omitido?: string }> {
  const agenda = config.agendaDiaria ?? {};

  if (!agenda.canalWhatsapp) return { enviados: 0, omitido: "Canal WhatsApp apagado" };
  if (config.whatsappActivo === false) return { enviados: 0, omitido: "WhatsApp desactivado" };
  if (!config.numberId) return { enviados: 0, omitido: "Falta numberId" };

  const quiereImagen = agenda.formatoWhatsapp === "imagen";
  const plantilla = quiereImagen ? config.plantillaAgendaImagen : config.plantillaAgenda;
  if (!plantilla) {
    return {
      enviados: 0,
      omitido: quiereImagen ? "Falta plantillaAgendaImagen" : "Falta plantillaAgenda",
    };
  }

  const conTelefono = destinatarios.filter((d) => d.telefono);
  if (conTelefono.length === 0) return { enviados: 0, omitido: "Nadie tiene telefono" };

  const numberSnap = await db.doc(`numbers/${config.numberId}`).get();
  if (!numberSnap.exists) return { enviados: 0, omitido: `numbers/${config.numberId} no existe` };
  const numberData = numberSnap.data() as { phoneNumberId: string; metaToken: string };

  // El CUERPO de una plantilla si admite saltos de linea; la duda es el valor de
  // un parametro. La documentacion de Meta dice que no, pero nunca lo habiamos
  // comprobado porque el codigo los borraba antes de enviar. Ahora se intenta
  // primero con saltos reales y, si Meta los rechaza, se reintenta aplanado.
  // El resultado queda en el log para saber en que modo quedo la cuenta.
  const recortar = (texto: string) =>
    texto.length > MAX_CARACTERES_PARAMETRO
      ? `${texto.slice(0, MAX_CARACTERES_PARAMETRO - 40)}... (ver la agenda completa en la app)`
      : texto;

  const separador = agenda.separador || " | ";
  const listadoConSaltos = recortar(lineas.map((l) => `- ${l.texto}`).join("\n"));
  const listadoPlano = recortar(
    sanitizeParameterValue(lineas.map((l) => l.texto).join(separador))
  );

  const fecha = sanitizeParameterValue(encabezado);
  const armar = (listado: string) => [
    { parameterName: "fecha", value: fecha },
    { parameterName: "agenda", value: listado },
  ];

  /** Meta responde 400 con este texto cuando el parametro trae saltos de linea. */
  function esErrorDeSaltoDeLinea(err: any): boolean {
    const mensaje = String(err?.message ?? "");
    return /new-?line|newline|tab characters|consecutive spaces/i.test(mensaje);
  }

  // La imagen se genera y se sube UNA vez; todos reciben el mismo enlace.
  let urlImagen: string | undefined;
  if (quiereImagen) {
    if (!hayTipografia()) {
      // Sin tipografia el PNG saldria en blanco: mejor mandar texto.
      logger.warn("[agendaDiaria] Sin tipografia en el contenedor, se envia texto");
    } else {
      try {
        const png = await generarImagenAgenda(encabezado, lineas);
        urlImagen = await subirImagen(png, encabezado);
        logger.info("[agendaDiaria] Imagen de la agenda lista", {
          bytes: png.length,
          url: urlImagen,
        });
      } catch (err: any) {
        logger.error("[agendaDiaria] Fallo la generacion de la imagen", {
          error: err?.message ?? String(err),
        });
      }
    }

    if (!urlImagen) {
      return {
        enviados: 0,
        omitido: "No se pudo generar la imagen; revisa el log y usa formato texto",
      };
    }
  }

  let permiteSaltos = true;
  let enviados = 0;

  for (const destinatario of conTelefono) {
    const telefono = normalizePhone(destinatario.telefono!);
    const enviar = (listado: string) =>
      callMetaTemplateApi(
        numberData.phoneNumberId,
        numberData.metaToken,
        telefono,
        plantilla,
        // En modo imagen el listado ya viaja dibujado: el cuerpo solo lleva la fecha.
        quiereImagen ? [{ parameterName: "fecha", value: fecha }] : armar(listado),
        urlImagen ? { headerImageUrl: urlImagen } : {}
      );

    try {
      if (permiteSaltos && !quiereImagen) {
        try {
          await enviar(listadoConSaltos);
          enviados++;
          continue;
        } catch (err: any) {
          if (!esErrorDeSaltoDeLinea(err)) throw err;
          // Meta los rechaza: se deja de intentar para el resto del lote.
          permiteSaltos = false;
          logger.warn(
            "[agendaDiaria] Meta rechazo los saltos de linea, se envia aplanado",
            { detalle: err?.message }
          );
        }
      }

      await enviar(listadoPlano);
      enviados++;
    } catch (err: any) {
      logger.error("[agendaDiaria] Fallo el envio por WhatsApp", {
        uid: destinatario.uid,
        error: err?.message ?? String(err),
      });
    }
  }

  logger.info("[agendaDiaria] Modo de formato usado en WhatsApp", {
    conSaltosDeLinea: permiteSaltos,
  });

  return { enviados };
}

// =====================================================
// Funcion programada
// =====================================================

export const agendaDiaria = onSchedule(
  {
    // 8:00 p. m. hora Colombia.
    schedule: "0 20 * * *",
    timeZone: ZONA,
    region: "us-central1",
    secrets: [GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN],
  },
  async () => {
    const db = admin.firestore();

    const snapConfig = await db.doc(DOC_CONFIG).get();
    const config = (snapConfig.exists ? snapConfig.data() : {}) as ConfigEventos;
    const agenda = config.agendaDiaria ?? {};

    // Opt-in explicito. Si el documento de configuracion no existe todavia,
    // `activa` llega undefined: sin esta guarda el envio se dispararia contra
    // TODO el equipo, porque los valores por defecto son "equipo" + correo.
    if (agenda.activa !== true) {
      logger.info(
        "[agendaDiaria] No esta activada. Enciendela en Ajustes > Agenda diaria."
      );
      return;
    }

    const { desde, hasta, dia } = ventanaMananaColombia(new Date());
    const lineas = await eventosDeManana(db, desde, hasta);
    const encabezado = encabezadoFecha(dia);

    if (lineas.length === 0) {
      // Sin eventos no se manda nada: un mensaje diario vacio se vuelve ruido y
      // la gente deja de leerlo.
      logger.info("[agendaDiaria] Sin eventos para manana, no se envia nada", { encabezado });
      return;
    }

    const destinatarios = await resolverDestinatarios(db, agenda);
    if (destinatarios.length === 0) {
      logger.warn("[agendaDiaria] Sin destinatarios configurados", { encabezado });
      return;
    }

    const asunto = `Agenda ${encabezado}`;
    const html = cuerpoHtml(encabezado, lineas);
    const texto = cuerpoTextoPlano(encabezado, lineas);

    let correosEnviados = 0;
    if (agenda.canalEmail !== false) {
      // Se deduplica por correo: dos usuarios podrian compartir buzon.
      const correos = new Set(
        destinatarios.map((d) => d.email).filter((c): c is string => !!c)
      );
      for (const correo of correos) {
        try {
          await sendEmail({ to: correo, subject: asunto, text: texto, html });
          correosEnviados++;
        } catch (err: any) {
          logger.error("[agendaDiaria] Fallo el envio por correo", {
            correo,
            error: err?.message ?? String(err),
          });
        }
      }
    }

    const resultadoWa = await enviarPorWhatsapp(db, config, destinatarios, encabezado, lineas);

    // Corre despues de enviar para no retrasar la entrega.
    const imagenesPurgadas = await purgarImagenes();

    logger.info("[agendaDiaria] Agenda enviada", {
      encabezado,
      eventos: lineas.length,
      destinatarios: destinatarios.length,
      correosEnviados,
      whatsappEnviados: resultadoWa.enviados,
      whatsappOmitido: resultadoWa.omitido,
      imagenesPurgadas,
    });
  }
);
