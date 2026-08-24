// src/modules/cobranza/services/reportes/reporteHabilitadoEmail.ts
import { enviarEmail } from "@/modules/notificaciones/services/notificacionService";
import { getClienteById } from "@/modules/clientes/services/clienteService";
import { getUsuarioByUid } from "@/modules/usuarios/services/usuarioService";

const APP_URL = "https://gestionglobal-9eac8.web.app";

/** URL directa al reporte del cliente */
export const buildUrlReporteCliente = (clienteId: string) =>
  `${APP_URL}/clientes/${clienteId}/reporte`;

const nombreMes = (month: number) => {
  const label = new Date(2024, month - 1, 1).toLocaleDateString("es-CO", {
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

/**
 * Correo asignado al cliente: primero el correo de contacto del conjunto y,
 * si no existe, el correo del usuario con el que ingresa a la plataforma.
 * (Mismo criterio que usa el módulo de correos.)
 */
export const obtenerContactoCliente = async (
  clienteId: string
): Promise<{ correo: string; nombre: string }> => {
  const [cliente, usuario] = await Promise.all([
    getClienteById(clienteId),
    getUsuarioByUid(clienteId).catch(() => null),
  ]);

  // El correo del conjunto es el de acceso del usuario: única fuente de verdad.
  const correo = (usuario?.email || "").trim();
  const nombre = (cliente?.nombre || usuario?.nombre || "Cliente").trim();

  return { correo, nombre };
};

type EnviarCorreoReporteInput = {
  clienteId: string;
  year: number;
  month: number;
  /** Nombre del conjunto (si ya lo tienes cargado en la página) */
  clienteNombre?: string;
  /** Correo destino (si se omite, se resuelve desde el cliente/usuario) */
  correoDestino?: string;
};

/**
 * Avisa al cliente que el informe del mes ya quedó disponible en GESGLO.
 * Usa la plantilla corporativa (encabezado + pie) de notificacionService.
 */
export const enviarCorreoReporteDisponible = async ({
  clienteId,
  year,
  month,
  clienteNombre,
  correoDestino,
}: EnviarCorreoReporteInput): Promise<string> => {
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

  const mes = nombreMes(month);
  const url = buildUrlReporteCliente(clienteId);

  await enviarEmail({
    nombreDestino: nombre || "Cliente",
    correoDestino: correo,
    subject: `Informe de gestión de cartera – ${mes} ${year}`,
    titulo: `Tu informe de ${mes} ${year} ya está disponible`,
    cuerpoHtml: `
      <p>Te informamos que el <strong>informe de gestión de cartera del mes de ${mes} de ${year}</strong>
      ya está disponible en <strong>GESGLO</strong>, la plataforma de gestión de cartera de
      <strong>Gestión Global ACG SAS</strong>.</p>

      <p>En el informe encontrarás:</p>
      <ul style="margin:0 0 16px;padding-left:18px;color:#374151;">
        <li>Resumen por tipificación de los inmuebles en cartera</li>
        <li>Recaudo del mes y comparativo mes a mes</li>
        <li>Seguimiento de los procesos jurídicos</li>
        <li>Valores agregados solicitados y entregados</li>
      </ul>

      <p style="margin:24px 0;text-align:center;">
        <a href="${url}"
           style="background:#111827;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:6px;display:inline-block;"
           target="_blank">Ver mi informe</a>
      </p>

      <p style="font-size:13px;color:#6b7280;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>
        <a href="${url}" style="color:#2563eb;text-decoration:none;" target="_blank">${url}</a>
      </p>

      <p>Recuerda que debes iniciar sesión con los datos de acceso que te enviamos al crear tu cuenta.
      Dentro del informe puedes seleccionar el <strong>año</strong> y el <strong>mes</strong> que deseas consultar
      (en este caso, ${mes} de ${year}). Si tienes alguna duda o necesitas ayuda para ingresar, no dudes en contactarnos.</p>

      <p style="margin-top:20px;">
        Cordialmente,<br/>
        <strong>Equipo Gestión Global A.C.G.</strong><br/>
        Área de Tecnología y Transformación Digital<br/>
        📧 gestionglobalacg@gestionglobalacg.com<br/>
        📞 (601) 4631148 · 57 316 6936088
      </p>
    `,
  });

  return correo;
};
