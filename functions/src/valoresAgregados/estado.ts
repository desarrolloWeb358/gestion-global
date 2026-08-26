import * as logger from "firebase-functions/logger";
import {
  avisar,
  destinatarioCliente,
  destinatariosJuridica,
  rutaValorAgregado,
  tipoLabel,
  type ClienteInfo,
} from "./shared";

/**
 * Qué se notifica cuando cambia el estado del trámite, venga de donde venga:
 * del botón Resolver/Reabrir del abogado, o de la reapertura automática que hace
 * conversacion.ts cuando el cliente escribe sobre un VA ya resuelto.
 *
 * Esto NO es una Cloud Function. Antes sí lo era, y convivía con
 * `notificarValorAgregadoActualizado` escuchando exactamente la misma ruta: cada
 * escritura levantaba las dos y cada una releía cliente + abogado + dependiente
 * por su cuenta, aunque una de las dos terminara saliendo por un return temprano.
 * Ahora el único trigger onUpdate vive en notificaciones.ts, lee esos datos una
 * sola vez y llama aquí si hubo transición.
 *
 * No hay riesgo de bucle: solo se escribe en `usuarios/{uid}/notificaciones`,
 * nunca en el propio valor agregado.
 */

const LOG_TAG = "notificarCambioEstado";

export type TransicionEstado = "abierto" | "resuelto";

/**
 * Devuelve el estado al que se movió el trámite, o `null` si esta escritura no
 * fue una transición de negocio.
 */
export function detectarTransicionEstado(
  before: any,
  after: any
): TransicionEstado | null {
  const estadoAntes = before?.estado;
  const estadoDespues = after?.estado;

  // Solo nos interesan las transiciones reales entre abierto y resuelto.
  if (estadoAntes === estadoDespues) return null;
  if (estadoDespues !== "abierto" && estadoDespues !== "resuelto") return null;
  // La migración rellena `estado` por primera vez: no es una transición de negocio.
  if (estadoAntes === undefined) return null;

  return estadoDespues;
}

export async function notificarTransicionEstado(input: {
  db: FirebaseFirestore.Firestore;
  clienteId: string;
  valorId: string;
  after: any;
  info: ClienteInfo;
  estadoDespues: TransicionEstado;
}): Promise<void> {
  const { db, clienteId, valorId, after, info, estadoDespues } = input;

  const nombreCliente = info.nombreCliente || clienteId;
  const tipoLbl = tipoLabel(after.tipo);
  const nombreValor = after.titulo || "Documento";
  const ruta = rutaValorAgregado(clienteId, valorId);

  const ficha = `
      <ul>
        <li><strong>Cliente:</strong> ${nombreCliente}</li>
        <li><strong>Tipo:</strong> ${tipoLbl}</li>
        <li><strong>Título:</strong> ${nombreValor}</li>
      </ul>
    `;

  if (estadoDespues === "resuelto") {
    // Se resolvió → se le avisa al cliente, que es quien radicó la solicitud.
    await avisar({
      db,
      destinatarios: [destinatarioCliente(clienteId, info)],
      ruta,
      descripcionAlerta: `Tu valor agregado (${tipoLbl}) fue resuelto: ${nombreValor}`,
      subject: `Valor agregado resuelto: ${tipoLbl}`,
      tituloCorreo: "Tu valor agregado fue resuelto",
      cuerpoHtmlCorreo: `
          <p>El área jurídica marcó como <strong>resuelto</strong> uno de tus valores agregados.</p>
          ${ficha}
          <p>Si necesitas algo más sobre esta solicitud, responde en la conversación y se reabrirá automáticamente.</p>
        `,
      logTag: LOG_TAG,
    });

    logger.info(`[${LOG_TAG}] ${valorId} resuelto; avisado el cliente ${clienteId}`);
    return;
  }

  // estadoDespues === "abierto" → se reabrió. Avisa a jurídica.
  // Distinguimos si fue el cliente escribiendo o el abogado reabriendo a mano.
  const porElCliente = after.esperaRespuestaDe === "juridica";
  const detalle = porElCliente
    ? "El cliente escribió de nuevo, así que el trámite se reabrió automáticamente."
    : "El área jurídica reabrió el trámite manualmente.";

  await avisar({
    db,
    destinatarios: destinatariosJuridica(info),
    ruta,
    descripcionAlerta: `Se reabrió el valor agregado (${tipoLbl}) del cliente ${nombreCliente}: ${nombreValor}`,
    subject: `Valor agregado reabierto: ${tipoLbl} - ${nombreCliente}`,
    tituloCorreo: "Se reabrió un valor agregado",
    cuerpoHtmlCorreo: `
        <p>${detalle}</p>
        ${ficha}
        <p>Ingresa a la plataforma para revisarlo. Si solo era un agradecimiento, puedes volver a marcarlo como resuelto sin responder.</p>
      `,
    logTag: LOG_TAG,
  });

  logger.info(
    `[${LOG_TAG}] ${valorId} reabierto (${porElCliente ? "por el cliente" : "manual"}); avisada jurídica`
  );
}
