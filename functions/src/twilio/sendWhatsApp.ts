import { getTwilioClient } from "./client";


export const sendWhatsApp = async (to: string, body: string) => {

  const client = getTwilioClient();
 
  const FROM_WHATSAPP = 'whatsapp:+12245058551';
  const message = await client.messages.create({
    body,
    from: FROM_WHATSAPP,
    to: `whatsapp:${to}`,
  });
  return message.sid;
};


export const sendWhatsAppTemplate = async (to: string, plantilla: string, variables?: Record<string, any>) => {
  const FROM_WHATSAPP = 'whatsapp:+12245058551';
  const client = getTwilioClient();

  const message = await client.messages.create({
    from: FROM_WHATSAPP,
    to: `whatsapp:${to}`,
    contentSid: plantilla, // SID del template
    contentVariables: JSON.stringify(variables || {}),
  });

  return message.sid;
};
