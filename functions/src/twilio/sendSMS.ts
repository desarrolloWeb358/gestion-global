import { twilioClient } from './client';

export const sendSMS = async (to: string, body: string) => {
  const from = process.env.TWILIO_PHONE_NUMBER!;
  const message = await twilioClient.messages.create({
    body,
    from,
    to,
  });
  return message.sid;
};
