import { getTwilioClient } from "./client";

export const sendSMS = async (to: string, body: string) => {

  const FROM_PHONE = '+12245058551';
  const client = getTwilioClient();
  

  const message = await client.messages.create({
    body,
    from: FROM_PHONE,
    to,
  });
  return message.sid;
};
