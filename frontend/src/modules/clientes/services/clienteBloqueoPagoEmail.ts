// src/modules/clientes/services/clienteBloqueoPagoEmail.ts
import { enviarEmail } from "@/modules/notificaciones/services/notificacionService";
import { obtenerContactoCliente } from "@/modules/cobranza/services/reportes/reporteHabilitadoEmail";

const APP_URL = "https://gestionglobal-9eac8.web.app";

/** Mismo correo de cartera que ve el cliente en `AvisoBloqueoPagoDialog`. */
const CORREO_CARTERA = "carterazona1@gestionglobalacg.com";

/**
 * Lo que se le dice al administrador cuando el ejecutivo no escribió un motivo.
 * La suspensión siempre es por no pago, así que el correo nunca sale mudo.
 */
const MOTIVO_POR_DEFECTO =
  "A la fecha no se ha registrado el pago de los honorarios correspondientes " +
  "al servicio de gestión de cartera.";

/** El motivo lo escribe una persona: no puede entrar crudo al HTML. */
const escaparHtml = (texto: string) =>
  texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const aParrafoHtml = (texto: string) =>
  escaparHtml(texto).replace(/\r?\n/g, "<br/>");

const FIRMA = `
  <p style="margin-top:20px;">
    Cordialmente,<br/>
    <strong>Equipo Gestión Global A.C.G.</strong><br/>
    Área de Cartera<br/>
    📧 ${CORREO_CARTERA}<br/>
    📞 (601) 4631148 · 57 316 6936088
  </p>
`;

type EnviarCorreoBloqueoInput = {
  clienteId: string;
  /** true = se inhabilitó el acceso; false = se reactivó. */
  bloqueado: boolean;
  /** Motivo escrito por el ejecutivo. Solo aplica al bloqueo. */
  motivo?: string;
  /** Nombre del conjunto, si la página ya lo tiene cargado. */
  clienteNombre?: string;
  /** Correo destino; si se omite se resuelve desde el cliente/usuario. */
  correoDestino?: string;
};

/**
 * Avisa por correo al administrador del conjunto cuando su acceso a GESGLO
 * queda suspendido por no pago, y cuando se reactiva.
 *
 * El destinatario se resuelve con el mismo criterio que el resto del módulo:
 * el correo de acceso del usuario del conjunto (`usuarios/{clienteId}.email`),
 * que es la única fuente de verdad del correo del cliente.
 *
 * Lanza si el conjunto no tiene correo asignado: quien llama decide qué hacer
 * con eso, porque el bloqueo en sí ya quedó guardado.
 */
export const enviarCorreoBloqueoPago = async ({
  clienteId,
  bloqueado,
  motivo,
  clienteNombre,
  correoDestino,
}: EnviarCorreoBloqueoInput): Promise<string> => {
  let correo = (correoDestino || "").trim();
  let nombre = (clienteNombre || "").trim();

  if (!correo || !nombre) {
    const contacto = await obtenerContactoCliente(clienteId);
    correo = correo || contacto.correo;
    nombre = nombre || contacto.nombre;
  }

  if (!correo) {
    throw new Error("El cliente no tiene un correo electrónico asignado");
  }

  const cuerpoHtml = bloqueado
    ? cuerpoSuspension(nombre, motivo)
    : cuerpoReactivacion(nombre);

  await enviarEmail({
    nombreDestino: nombre || "Administrador",
    correoDestino: correo,
    subject: bloqueado
      ? `Suspensión temporal del acceso a GESGLO – ${nombre}`
      : `Reactivación del acceso a GESGLO – ${nombre}`,
    titulo: bloqueado
      ? "Acceso a la plataforma suspendido temporalmente"
      : "Acceso a la plataforma reactivado",
    cuerpoHtml,
  });

  return correo;
};

const cuerpoSuspension = (nombre: string, motivo?: string) => {
  const detalle = (motivo || "").trim();
  const textoMotivo = detalle ? aParrafoHtml(detalle) : MOTIVO_POR_DEFECTO;

  return `
    <p>Reciba un cordial saludo de <strong>Gestión Global ACG SAS</strong>.</p>

    <p>Por medio del presente le informamos que el acceso a la información de
    <strong>${escaparHtml(nombre)}</strong> en <strong>GESGLO</strong>, nuestra
    plataforma de gestión de cartera, ha sido <strong>suspendido de manera
    temporal</strong> por encontrarse pendiente el pago de los honorarios del
    servicio.</p>

    <div style="margin:20px 0;padding:14px 16px;border-left:4px solid #b45309;background:#fffbeb;border-radius:4px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#92400e;">
        Motivo de la suspensión
      </p>
      <p style="margin:0;color:#374151;">${textoMotivo}</p>
    </div>

    <p>Durante la suspensión su usuario <strong>continúa activo y puede iniciar
    sesión con normalidad</strong>, pero la consulta de los módulos de deudores,
    valores agregados, informes, seguimiento y contratos permanecerá
    deshabilitada hasta que se verifique el pago.</p>

    <p><strong>¿Ya realizó el pago?</strong> Le agradecemos remitir el soporte
    correspondiente a su ejecutivo de cuenta o al correo
    <a href="mailto:${CORREO_CARTERA}" style="color:#2563eb;text-decoration:none;">${CORREO_CARTERA}</a>.
    Una vez verificado, el acceso se restablece de forma inmediata.</p>

    <p>Agradecemos su comprensión y quedamos atentos a cualquier inquietud.</p>

    ${FIRMA}
  `;
};

const cuerpoReactivacion = (nombre: string) => `
  <p>Reciba un cordial saludo de <strong>Gestión Global ACG SAS</strong>.</p>

  <p>Nos permitimos informarle que el acceso de
  <strong>${escaparHtml(nombre)}</strong> a <strong>GESGLO</strong> fue
  <strong>reactivado</strong>. Desde este momento puede consultar nuevamente la
  totalidad de la información del conjunto: deudores, valores agregados,
  informes de gestión, seguimiento y contratos.</p>

  <p style="margin:24px 0;text-align:center;">
    <a href="${APP_URL}"
       style="background:#111827;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:6px;display:inline-block;"
       target="_blank">Ingresar a GESGLO</a>
  </p>

  <p style="font-size:13px;color:#6b7280;">
    Si el botón no funciona, copie y pegue este enlace en su navegador:<br/>
    <a href="${APP_URL}" style="color:#2563eb;text-decoration:none;" target="_blank">${APP_URL}</a>
  </p>

  <p>Agradecemos su gestión y la confianza depositada en nuestro equipo.</p>

  ${FIRMA}
`;
