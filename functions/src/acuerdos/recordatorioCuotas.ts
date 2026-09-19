// Recordatorio automatico de la cuota que esta por vencerse, todos los dias a
// las 10:00 a. m.
//
// QUE HACE: por cada acuerdo de pago EN FIRME busca las cuotas cuya `fechaPago`
// cae en alguno de los hitos configurados (5 y 1 dias antes, por defecto) y le
// escribe al deudor por WhatsApp y por correo. Los dos hitos los atiende la
// MISMA corrida: cada dia se pregunta "que vence en 5 dias" y "que vence
// manana", y una cuota recibe su aviso en los dos momentos.
//
// Cada envio queda como una gestion mas en el seguimiento del deudor, y si al
// deudor le falta el telefono o el correo TAMBIEN queda la constancia de que no
// se le pudo escribir por ese canal: para la cobranza "no tiene correo
// registrado" es informacion, no es un no-evento.
//
// POR QUE NO CONSULTA LAS CUOTAS DIRECTO: las cuotas viven en una subcoleccion
// y su documento no sabe a que acuerdo pertenece ni en que estado esta ese
// acuerdo. Un collectionGroup("cuotas") traeria tambien las de los BORRADORES y
// las de los acuerdos INCUMPLIDOS. Por eso se parte de los acuerdos vigentes
// (una sola consulta indexada) y de ahi se baja a sus cuotas.
//
// POR QUE MARCA LA CUOTA: el hito es un dia calendario, asi que en la operacion
// normal cada aviso sale una sola vez. La marca `recordatorios` no esta para
// eso: esta para el dia en que la corrida se cae a la mitad y Cloud Functions la
// reintenta, que sin ella volveria a escribirle a los deudores que ya alcanzo a
// notificar. Se guarda por hito (`recordatorios.5`, `recordatorios.1`) para que
// el aviso de los 5 dias no tape el de 1 dia. Es seguro escribir sobre la cuota
// porque un acuerdo EN FIRME es de solo lectura en la aplicacion: nadie
// reescribe sus cuotas.

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  GMAIL_USER_CARTERA,
  GMAIL_REFRESH_TOKEN_CARTERA,
  GMAIL_USER,
  sendEmail,
} from "../notificaciones/sendEmail";
import { callMetaTemplateApi, normalizePhone, sanitizeParameterValue } from "../whatsapp/metaApi";
import { coleccionSeguimiento } from "../shared/tipificaciones";

const ZONA = "America/Bogota";
const DOC_CONFIG = "configuracion/acuerdos";

/** Colombia es UTC-5 fijo y sin horario de verano. */
const OFFSET_COLOMBIA_MS = 5 * 60 * 60 * 1000;

/** Quien figura como autor de la gestion. El envio no es de ninguna persona. */
const EJECUTIVO_SISTEMA = "sistema";

/** Hitos por defecto: 5 dias antes y la vispera. */
const DIAS_AVISO_POR_DEFECTO = [5, 1];

/** Campo del documento de cuota donde se anotan los avisos ya mandados. */
const CAMPO_MARCA = "recordatorios";

/**
 * Tope de acuerdos que se revisan por corrida. Con los hitos normales lo comun
 * es que venzan unas pocas decenas de cuotas por dia; el tope solo existe para
 * que una migracion que deje miles de acuerdos en firme no convierta una
 * corrida en una factura. Si se alcanza, queda avisado en el log.
 */
const MAX_ACUERDOS = 500;

/** Ritmo defensivo entre envios, igual que el job de WhatsApp masivo. */
const DELAY_ENVIO_MS = 300;

interface ConfigAcuerdos {
  /** Interruptor maestro del recordatorio. Opt-in explicito. */
  activa?: boolean;
  /** Dias de anticipacion con los que se avisa. Uno por hito. */
  diasAviso?: number[];
  /**
   * Conjuntos (clientes) a los que se les envia. Vacio o ausente = todos.
   * Sirve para estrenar la automatizacion contra una sola cartera antes de
   * abrirla a toda la plataforma.
   */
  clientesPermitidos?: string[];
  canalEmail?: boolean;
  canalWhatsapp?: boolean;
  /** Interruptor maestro del canal WhatsApp de este modulo. */
  whatsappActivo?: boolean;
  /** Documento de la coleccion `numbers` que se usa para enviar. */
  numberId?: string | null;
  /** Plantilla de Meta. Parametros: nombre, cuota, valor, fecha. */
  plantillaCuota?: string;
}

/** Una cuota que toca recordar en un hito, con todo lo que el mensaje necesita. */
interface Aviso {
  clienteId: string;
  deudorId: string;
  acuerdoId: string;
  cuotaRef: admin.firestore.DocumentReference;

  deudorNombre: string;
  tipificacion: string | null;
  telefono: string | null;
  correo: string | null;

  numeroCuota: number;
  totalCuotas: number;
  valorCuota: number;
  fechaPago: Date;

  /** El hito que disparo este aviso: 5, 1, ... */
  diasAntes: number;
}

/** Resultado de intentar un canal, tal como queda descrito en el seguimiento. */
type ResultadoCanal =
  | { estado: "enviado"; destino: string }
  | { estado: "sin_dato" }
  | { estado: "error"; motivo: string };

type Canal = "whatsapp" | "correo";

// =====================================================
// Fechas
// =====================================================

/** El dia calendario (en Colombia) al que pertenece un instante, como "AAAA-MM-DD". */
function diaColombia(fecha: Date): string {
  return new Date(fecha.getTime() - OFFSET_COLOMBIA_MS).toISOString().slice(0, 10);
}

/** El dia calendario que cae `dias` dias despues de hoy, en Colombia. */
function diaObjetivo(ahora: Date, dias: number): string {
  return diaColombia(new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000));
}

/** Medianoche (hora de Colombia) del dia "AAAA-MM-DD", como instante absoluto. */
function inicioDelDia(dia: string): Date {
  return new Date(Date.parse(`${dia}T00:00:00.000Z`) + OFFSET_COLOMBIA_MS);
}

/** El ultimo instante de ese mismo dia colombiano. */
function finDelDia(dia: string): Date {
  return new Date(inicioDelDia(dia).getTime() + 24 * 60 * 60 * 1000 - 1);
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "1 de agosto de 2026", leyendo la fecha como dia colombiano. */
function fechaLarga(fecha: Date): string {
  const [anio, mes, dia] = diaColombia(fecha).split("-");
  return `${Number(dia)} de ${MESES[Number(mes) - 1]} de ${anio}`;
}

/** "$200.000". Sin decimales: los acuerdos se pactan en pesos redondos. */
function moneda(valor: number): string {
  return `$${Math.round(valor).toLocaleString("es-CO")}`;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Los hitos configurados, saneados: enteros >= 0, sin repetidos y del mas
 * lejano al mas cercano. Una lista vacia o con basura cae en los de por defecto.
 */
function normalizarDiasAviso(valor: unknown): number[] {
  const dias = Array.isArray(valor) ? valor : [];
  const limpios = [
    ...new Set(
      dias
        .map((d) => Number(d))
        .filter((d) => Number.isFinite(d) && d >= 0)
        .map((d) => Math.round(d))
    ),
  ].sort((a, b) => b - a);

  return limpios.length > 0 ? limpios : DIAS_AVISO_POR_DEFECTO;
}

// =====================================================
// Contacto del deudor
// =====================================================

/**
 * Primer telefono utilizable del deudor, en el formato que espera Meta.
 *
 * Los telefonos se guardan a 10 digitos (ver el ajuste masivo de telefonos en
 * Ajustes), pero hay registros viejos que ya traen el 57 adelante; se aceptan
 * los dos y se descarta cualquier otra cosa antes de gastar una llamada a la
 * API.
 */
function primerTelefono(telefonos: unknown): string | null {
  if (!Array.isArray(telefonos)) return null;

  for (const bruto of telefonos) {
    const digitos = normalizePhone(String(bruto ?? ""));
    if (digitos.length === 10) return `57${digitos}`;
    if (digitos.length === 12 && digitos.startsWith("57")) return digitos;
  }
  return null;
}

/** Primer correo con forma de correo. */
function primerCorreo(correos: unknown): string | null {
  if (!Array.isArray(correos)) return null;

  for (const bruto of correos) {
    const correo = String(bruto ?? "").trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return correo;
  }
  return null;
}

/** El deudor puede llamarse `nombre` o, en registros viejos, `nombreResponsable`. */
function nombreDeudor(data: admin.firestore.DocumentData | undefined): string {
  const nombre = String(data?.nombre ?? data?.nombreResponsable ?? "").trim();
  return nombre || "Estimado cliente";
}

// =====================================================
// Busqueda de cuotas por vencer
// =====================================================

/**
 * Los acuerdos vigentes de toda la plataforma. El par (EN_FIRME, esActivo) es
 * lo que marca el acuerdo vigente de un deudor: ver `activarAcuerdoEnFirme`,
 * que al dejar uno en firme cierra el anterior.
 */
async function acuerdosVigentes(
  db: admin.firestore.Firestore
): Promise<admin.firestore.QueryDocumentSnapshot[]> {
  const snap = await db
    .collectionGroup("acuerdos")
    .where("estado", "==", "EN_FIRME")
    .where("esActivo", "==", true)
    .limit(MAX_ACUERDOS)
    .get();

  if (snap.size === MAX_ACUERDOS) {
    logger.warn(
      "[recordatorioCuotas] Se alcanzo el tope de acuerdos por corrida: puede haber cuotas sin revisar",
      { tope: MAX_ACUERDOS }
    );
  }

  return snap.docs;
}

/** El clienteId del que cuelga un acuerdo, o null si la ruta no es la esperada. */
function clienteIdDeAcuerdo(acuerdoSnap: admin.firestore.QueryDocumentSnapshot): string | null {
  // clientes/{clienteId}/deudores/{deudorId}/acuerdos/{acuerdoId}
  return acuerdoSnap.ref.parent.parent?.parent.parent?.id ?? null;
}

/**
 * Los avisos que salen de un acuerdo vigente: una entrada por cada cuota que
 * cae en un hito y todavia no lo ha recibido.
 *
 * COSTO: la consulta trae SOLO las cuotas dentro de la ventana que cubre los
 * hitos (del mas cercano al mas lejano), no las ~16 que tiene un acuerdo tipico.
 * En la inmensa mayoria de los acuerdos no cae ninguna y la consulta cuesta la
 * lectura minima de 1. El total de cuotas (el "de 6" del mensaje) y el deudor
 * solo se leen cuando de verdad hay algo que notificar.
 *
 * El rango va sobre `fechaPago` a secas, sin `orderBy("numero")`: mezclar un
 * filtro de rango con un orden por otro campo obligaria a un indice compuesto
 * por subcoleccion, y el orden aqui da igual.
 */
async function avisosDeAcuerdo(
  acuerdoSnap: admin.firestore.QueryDocumentSnapshot,
  objetivos: Map<string, number>,
  ventana: { desde: Date; hasta: Date }
): Promise<Aviso[]> {
  const deudorRef = acuerdoSnap.ref.parent.parent;
  const clienteId = clienteIdDeAcuerdo(acuerdoSnap);
  if (!deudorRef || !clienteId) {
    logger.warn("[recordatorioCuotas] Acuerdo en una ruta inesperada", {
      path: acuerdoSnap.ref.path,
    });
    return [];
  }

  const cuotasCol = acuerdoSnap.ref.collection("cuotas");
  const candidatasSnap = await cuotasCol
    .where("fechaPago", ">=", admin.firestore.Timestamp.fromDate(ventana.desde))
    .where("fechaPago", "<=", admin.firestore.Timestamp.fromDate(ventana.hasta))
    .get();

  if (candidatasSnap.empty) return [];

  // La ventana es continua, pero los hitos son dias sueltos dentro de ella: una
  // cuota que cae en un dia intermedio no lleva aviso.
  const porNotificar: { cuota: admin.firestore.QueryDocumentSnapshot; diasAntes: number }[] = [];

  for (const cuotaSnap of candidatasSnap.docs) {
    const fecha: Date | undefined = cuotaSnap.data()?.fechaPago?.toDate?.();
    if (!fecha) continue;

    const diasAntes = objetivos.get(diaColombia(fecha));
    if (diasAntes === undefined) continue;

    // Ya se le escribio por esta cuota en este hito: un reintento no repite.
    const marcas = cuotaSnap.data()?.[CAMPO_MARCA];
    if (marcas && marcas[String(diasAntes)]) continue;

    porNotificar.push({ cuota: cuotaSnap, diasAntes });
  }

  if (porNotificar.length === 0) return [];

  // Hasta aqui no se habia gastado ninguna lectura de mas: estas dos solo
  // ocurren en los pocos acuerdos que si tienen algo que avisar hoy.
  const [deudorSnap, totalSnap] = await Promise.all([
    deudorRef.get(),
    cuotasCol.count().get(),
  ]);

  if (!deudorSnap.exists) return [];
  const deudor = deudorSnap.data();

  const contacto = {
    deudorNombre: nombreDeudor(deudor),
    tipificacion: (deudor?.tipificacion as string) ?? null,
    telefono: primerTelefono(deudor?.telefonos),
    correo: primerCorreo(deudor?.correos),
  };

  return porNotificar.map(({ cuota, diasAntes }) => ({
    clienteId,
    deudorId: deudorRef.id,
    acuerdoId: acuerdoSnap.id,
    cuotaRef: cuota.ref,
    ...contacto,

    numeroCuota: Number(cuota.data()?.numero ?? 0),
    totalCuotas: totalSnap.data().count,
    valorCuota: Number(cuota.data()?.valorCuota ?? 0),
    fechaPago: cuota.data().fechaPago.toDate(),
    diasAntes,
  }));
}

// =====================================================
// Mensajes
// =====================================================

/** Los nombres de deudor los escribe el usuario: pueden traer <, > o &. */
function escapar(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * El cuerpo del correo. El HTML se arma aqui y no con `buildEmailHtml` de
 * valores agregados porque ese constructor solo sabe pintar un boton que dice
 * "Ver valor agregado", y este correo va para el deudor, no para el equipo.
 */
function cuerpoCorreoHtml(aviso: Aviso): string {
  return `
    <!doctype html>
    <html lang="es">
    <head><meta charset="utf-8"/><title>Recordatorio de pago</title></head>
    <body style="margin:0;padding:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 10px 15px rgba(0,0,0,0.05);">
            <tr><td style="background:#111827;color:#f9fafb;padding:16px 24px;">
              <h1 style="margin:0;font-size:20px;">Gestion Global</h1>
              <p style="margin:4px 0 0;font-size:13px;opacity:.8;">Recordatorio de pago</p>
            </td></tr>
            <tr><td style="padding:24px;">
              <p style="margin:0 0 16px;font-size:15px;color:#111827;">
                Hola <strong>${escapar(aviso.deudorNombre)}</strong>, te recordamos que se
                aproxima el pago de tu acuerdo de pago.
              </p>

              <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:20px;">
                <tr>
                  <td style="padding:10px 12px;background:#f9fafb;font-size:13px;color:#6b7280;">Cuota</td>
                  <td style="padding:10px 12px;background:#f9fafb;font-size:14px;color:#111827;font-weight:bold;">
                    ${aviso.numeroCuota} de ${aviso.totalCuotas}
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 12px;font-size:13px;color:#6b7280;">Valor a pagar</td>
                  <td style="padding:10px 12px;font-size:14px;color:#111827;font-weight:bold;">
                    ${moneda(aviso.valorCuota)}
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 12px;background:#f9fafb;font-size:13px;color:#6b7280;">Fecha de pago</td>
                  <td style="padding:10px 12px;background:#f9fafb;font-size:14px;color:#111827;font-weight:bold;">
                    ${fechaLarga(aviso.fechaPago)}
                  </td>
                </tr>
              </table>

              <p style="margin:0;padding:12px;border-radius:6px;background:#eff6ff;font-size:13px;color:#1e40af;line-height:1.5;">
                Si ya realizaste el pago, por favor envianos el soporte de pago y haz caso
                omiso a este mensaje.
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

function cuerpoCorreoTexto(aviso: Aviso): string {
  return [
    `Hola ${aviso.deudorNombre},`,
    "",
    "Te recordamos que se aproxima el pago de tu acuerdo de pago.",
    "",
    `  Cuota:         ${aviso.numeroCuota} de ${aviso.totalCuotas}`,
    `  Valor a pagar: ${moneda(aviso.valorCuota)}`,
    `  Fecha de pago: ${fechaLarga(aviso.fechaPago)}`,
    "",
    "Si ya realizaste el pago, por favor envianos el soporte de pago y haz caso",
    "omiso a este mensaje.",
    "",
    "Gestion Global",
  ].join("\n");
}

// =====================================================
// Envio por canal
// =====================================================

async function enviarCorreo(aviso: Aviso): Promise<ResultadoCanal> {
  if (!aviso.correo) return { estado: "sin_dato" };

  try {
    await sendEmail({
      to: aviso.correo,
      remitente: "cartera",
      subject: `Recordatorio de pago - cuota ${aviso.numeroCuota} de tu acuerdo de pago`,
      text: cuerpoCorreoTexto(aviso),
      html: cuerpoCorreoHtml(aviso),
    });
    return { estado: "enviado", destino: aviso.correo };
  } catch (err: any) {
    return { estado: "error", motivo: err?.message ?? String(err) };
  }
}

async function enviarWhatsapp(
  aviso: Aviso,
  linea: { phoneNumberId: string; metaToken: string },
  plantilla: string
): Promise<ResultadoCanal> {
  if (!aviso.telefono) return { estado: "sin_dato" };

  try {
    await callMetaTemplateApi(
      linea.phoneNumberId,
      linea.metaToken,
      aviso.telefono,
      plantilla,
      [
        { parameterName: "nombre", value: sanitizeParameterValue(aviso.deudorNombre) },
        { parameterName: "cuota", value: String(aviso.numeroCuota) },
        { parameterName: "valor", value: moneda(aviso.valorCuota) },
        { parameterName: "fecha", value: fechaLarga(aviso.fechaPago) },
      ]
    );
    return { estado: "enviado", destino: aviso.telefono };
  } catch (err: any) {
    return { estado: "error", motivo: err?.message ?? String(err) };
  }
}

// =====================================================
// Seguimiento
// =====================================================

/** "5 dias antes" / "el dia antes" / "el mismo dia", para el texto de la gestion. */
function comoHito(diasAntes: number): string {
  if (diasAntes === 0) return "el mismo dia del vencimiento";
  if (diasAntes === 1) return "un dia antes del vencimiento";
  return `${diasAntes} dias antes del vencimiento`;
}

function descripcionSeguimiento(
  aviso: Aviso,
  canal: Canal,
  resultado: ResultadoCanal
): string {
  const canalTexto = canal === "whatsapp" ? "WhatsApp" : "correo";
  const encabezado =
    `Recordatorio automatico (${comoHito(aviso.diasAntes)}) de la cuota ` +
    `${aviso.numeroCuota} de ${aviso.totalCuotas} del acuerdo de pago, por ` +
    `${moneda(aviso.valorCuota)}, que vence el ${fechaLarga(aviso.fechaPago)}.`;

  if (resultado.estado === "enviado") {
    return `${encabezado} Enviado por ${canalTexto} a ${resultado.destino}.`;
  }
  if (resultado.estado === "sin_dato") {
    const dato = canal === "whatsapp" ? "numero de WhatsApp" : "correo electronico";
    return `${encabezado} No se envio por ${canalTexto}: el deudor no tiene ${dato} registrado.`;
  }
  return `${encabezado} Fallo el envio por ${canalTexto}: ${resultado.motivo}`;
}

/**
 * Deja el envio como gestion del deudor, en la coleccion que le corresponde a
 * su tipificacion.
 *
 * La forma del documento tiene que ser la misma que escribe la pantalla de
 * seguimientos y el envio masivo de WhatsApp: `fechaCreacion` + `clienteUID` +
 * `ejecutivoUID` son los campos por los que consulta el reporte de seguimientos
 * por ejecutivo.
 */
async function registrarSeguimiento(
  db: admin.firestore.Firestore,
  aviso: Aviso,
  canal: Canal,
  resultado: ResultadoCanal
): Promise<void> {
  const ahora = admin.firestore.Timestamp.now();
  const deudorRef = db.doc(`clientes/${aviso.clienteId}/deudores/${aviso.deudorId}`);

  await deudorRef.collection(coleccionSeguimiento(aviso.tipificacion)).add({
    fecha: ahora,
    fechaCreacion: ahora,
    clienteUID: aviso.clienteId,
    ejecutivoUID: EJECUTIVO_SISTEMA,
    tipoSeguimiento: canal,
    descripcion: descripcionSeguimiento(aviso, canal, resultado),
    actualizadoEn: ahora,
  });
}

/**
 * Solo hacia adelante: un envio automatico no puede "envejecer" una gestion
 * posterior que haya quedado registrada mientras corria el job.
 */
async function refrescarUltimoSeguimiento(
  db: admin.firestore.Firestore,
  clienteId: string,
  deudorId: string
): Promise<void> {
  const deudorRef = db.doc(`clientes/${clienteId}/deudores/${deudorId}`);
  const ahora = admin.firestore.Timestamp.now();
  const snap = await deudorRef.get();
  const actual = snap.data()?.fechaUltimoSeguimiento as admin.firestore.Timestamp | undefined;

  if (!actual || ahora.toMillis() > (actual.toMillis?.() ?? 0)) {
    await deudorRef.update({ fechaUltimoSeguimiento: ahora });
  }
}

// =====================================================
// Funcion programada
// =====================================================

export const recordatorioCuotasAcuerdo = onSchedule(
  {
    // 10:00 a. m. todos los dias. La misma corrida atiende todos los hitos.
    schedule: "0 10 * * *",
    timeZone: ZONA,
    region: "us-central1",
    secrets: [
      GMAIL_USER,
      GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET,
      GMAIL_REFRESH_TOKEN,
      // Sin estos dos, el envio como `cartera` cae al modo alias sin avisar.
      GMAIL_USER_CARTERA,
      GMAIL_REFRESH_TOKEN_CARTERA,
    ],
  },
  async () => {
    const db = admin.firestore();

    const snapConfig = await db.doc(DOC_CONFIG).get();
    const config = (snapConfig.exists ? snapConfig.data() : {}) as ConfigAcuerdos;

    // Opt-in explicito. Si el documento de configuracion todavia no existe,
    // `activa` llega undefined: sin esta guarda el primer despliegue le
    // escribiria a todos los deudores con acuerdo vigente.
    if (config.activa !== true) {
      logger.info(
        "[recordatorioCuotas] No esta activado. Enciendelo en Ajustes > Recordatorio de cuotas."
      );
      return;
    }

    const diasAviso = normalizarDiasAviso(config.diasAviso);
    const permitidos = new Set(
      (Array.isArray(config.clientesPermitidos) ? config.clientesPermitidos : [])
        .map((c) => String(c ?? "").trim())
        .filter(Boolean)
    );

    // Un dia calendario por hito. Como los hitos son distintos entre si, cada
    // dia objetivo apunta a un solo hito.
    const ahora = new Date();
    const objetivos = new Map<string, number>();
    for (const dias of diasAviso) objetivos.set(diaObjetivo(ahora, dias), dias);

    // `diasAviso` viene del mas lejano al mas cercano, asi que la ventana va del
    // hito mas cercano al mas lejano. Es el rango con el que se consulta cada
    // subcoleccion de cuotas: sin el habria que traer las ~16 cuotas de cada
    // acuerdo vigente para descartarlas casi todas.
    const ventana = {
      desde: inicioDelDia(diaObjetivo(ahora, diasAviso[diasAviso.length - 1])),
      hasta: finDelDia(diaObjetivo(ahora, diasAviso[0])),
    };

    const todos = await acuerdosVigentes(db);

    // El filtro por conjunto va ANTES de leer las cuotas, que es donde esta el
    // costo de verdad: un acuerdo son ~12 lecturas de cuota contra 1 de acuerdo.
    const acuerdos =
      permitidos.size > 0
        ? todos.filter((a) => {
            const clienteId = clienteIdDeAcuerdo(a);
            return !!clienteId && permitidos.has(clienteId);
          })
        : todos;

    if (acuerdos.length === 0) {
      logger.info("[recordatorioCuotas] No hay acuerdos EN FIRME activos que revisar", {
        vigentesEnTotal: todos.length,
        clientesPermitidos: [...permitidos],
      });
      return;
    }

    const avisos: Aviso[] = [];
    for (const acuerdo of acuerdos) {
      avisos.push(...(await avisosDeAcuerdo(acuerdo, objetivos, ventana)));
    }

    if (avisos.length === 0) {
      logger.info("[recordatorioCuotas] Ninguna cuota cae en los hitos de hoy", {
        objetivos: [...objetivos.entries()],
        acuerdosRevisados: acuerdos.length,
      });
      return;
    }

    // ── Canal WhatsApp: la linea se resuelve una sola vez para todo el lote ──
    let linea: { phoneNumberId: string; metaToken: string } | null = null;
    const plantilla = config.plantillaCuota;
    let omitidoWa: string | undefined;

    if (config.canalWhatsapp !== true) omitidoWa = "Canal WhatsApp apagado";
    else if (config.whatsappActivo === false) omitidoWa = "WhatsApp desactivado";
    else if (!config.numberId) omitidoWa = "Falta numberId";
    else if (!plantilla) omitidoWa = "Falta plantillaCuota";
    else {
      const numberSnap = await db.doc(`numbers/${config.numberId}`).get();
      if (!numberSnap.exists) omitidoWa = `numbers/${config.numberId} no existe`;
      else linea = numberSnap.data() as { phoneNumberId: string; metaToken: string };
    }

    if (omitidoWa) {
      logger.info("[recordatorioCuotas] No se envia por WhatsApp", { motivo: omitidoWa });
    }

    const canalEmail = config.canalEmail !== false;

    let correosEnviados = 0;
    let whatsappEnviados = 0;
    let sinCorreo = 0;
    let sinTelefono = 0;
    let fallidos = 0;

    for (const aviso of avisos) {
      const resultados: { canal: Canal; resultado: ResultadoCanal }[] = [];

      if (canalEmail) {
        const resultado = await enviarCorreo(aviso);
        resultados.push({ canal: "correo", resultado });

        if (resultado.estado === "enviado") correosEnviados++;
        else if (resultado.estado === "sin_dato") sinCorreo++;
        else fallidos++;
      }

      if (linea && plantilla) {
        const resultado = await enviarWhatsapp(aviso, linea, plantilla);
        resultados.push({ canal: "whatsapp", resultado });

        if (resultado.estado === "enviado") whatsappEnviados++;
        else if (resultado.estado === "sin_dato") sinTelefono++;
        else fallidos++;
      }

      // El seguimiento y la marca van despues de los envios y nunca tumban la
      // corrida: perder la constancia de un deudor es mejor que dejar sin
      // recordatorio a los que faltan.
      try {
        for (const { canal, resultado } of resultados) {
          await registrarSeguimiento(db, aviso, canal, resultado);

          if (resultado.estado === "error") {
            logger.error("[recordatorioCuotas] Fallo un envio", {
              canal,
              clienteId: aviso.clienteId,
              deudorId: aviso.deudorId,
              motivo: resultado.motivo,
            });
          }
        }

        if (resultados.length > 0) {
          await refrescarUltimoSeguimiento(db, aviso.clienteId, aviso.deudorId);
        }

        // Solo este hito queda marcado: los demas siguen pendientes.
        await aviso.cuotaRef.update(
          new admin.firestore.FieldPath(CAMPO_MARCA, String(aviso.diasAntes)),
          {
            enviadoEn: admin.firestore.Timestamp.now(),
            correo: resultados.find((r) => r.canal === "correo")?.resultado.estado ?? "omitido",
            whatsapp:
              resultados.find((r) => r.canal === "whatsapp")?.resultado.estado ?? "omitido",
          }
        );
      } catch (err: any) {
        logger.error("[recordatorioCuotas] No se pudo dejar constancia del envio", {
          clienteId: aviso.clienteId,
          deudorId: aviso.deudorId,
          acuerdoId: aviso.acuerdoId,
          diasAntes: aviso.diasAntes,
          error: err?.message ?? String(err),
        });
      }

      await esperar(DELAY_ENVIO_MS);
    }

    logger.info("[recordatorioCuotas] Corrida terminada", {
      objetivos: [...objetivos.entries()],
      diasAviso,
      clientesPermitidos: [...permitidos],
      acuerdosRevisados: acuerdos.length,
      avisos: avisos.length,
      correosEnviados,
      whatsappEnviados,
      sinCorreo,
      sinTelefono,
      fallidos,
    });
  }
);
