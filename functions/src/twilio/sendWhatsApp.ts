import { twilioClient } from './client';

export const sendWhatsApp = async (to: string, body: string) => {
  const from = process.env.TWILIO_WHATSAPP_NUMBER!;
  const message = await twilioClient.messages.create({
    body,
    from,
    to: `whatsapp:${to}`,
  });
  return message.sid;
};
