
import { sendNotification } from "@/shared/services/sendNotification";


type Destinatarios = {
  correoCliente?: string;
  whatsappCliente?: string; // en formato E.164 (+57...)
};

type PayloadBasico = {
  nombreDestinatario: string;
  nombreCliente: string;
  tipoLabel: string;   // p.ej. "Derecho de Petición"
  nombreValor: string; // p.ej. "DP-2025-001"
  descripcionValor: string;
};

export async function enviarNotificacionValorAgregadoBasico(
  correoDestino: string | undefined,
  data: PayloadBasico
): Promise<void> {
  if (!correoDestino) {
    console.warn(
      "[enviarNotificacionValorAgregadoBasico] Sin correo destino, no se envía nada."
    );
    return;
  }

  const subject = `Nuevo valor agregado: ${data.tipoLabel}`;
  const text = `Hola ${data.nombreDestinatario},

Se ha registrado un nuevo valor agregado en la plataforma.

Cliente: ${data.nombreCliente}
Tipo: ${data.tipoLabel}
Nombre: ${data.nombreValor}
Descripción: ${data.descripcionValor} 

Por favor ingresa a la plataforma de Gestión Global para ver más detalles.`;

  const html = `
    <p>Hola <strong>${data.nombreDestinatario}</strong>,</p>
    <p>Se ha registrado un nuevo <strong>valor agregado</strong> en la plataforma.</p>
    <ul>
      <li><strong>Cliente:</strong> ${data.nombreCliente}</li>
      <li><strong>Tipo:</strong> ${data.tipoLabel}</li>
      <li><strong>Nombre:</strong> ${data.nombreValor}</li>
      <li><strong>Descripción:</strong> ${data.descripcionValor}</li>
    </ul>
    <p>Por favor ingresa a la plataforma de Gestión Global para ver más detalles.</p>
  `;

  await sendNotification({
    to: correoDestino,
    subject,
    text,
    html,
  });
}
