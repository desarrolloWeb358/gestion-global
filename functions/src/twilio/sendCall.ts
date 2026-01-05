import { getTwilioClient } from "./client";
import twilio from "twilio";

export const sendCall = async (to: string, audioUrl: string) => {
  
  const FROM_PHONE = '+12245058551';
  const client = getTwilioClient();
  
  const voiceResponse = new twilio.twiml.VoiceResponse();
  voiceResponse.play(audioUrl); // ✅ maneja internamente los caracteres

  const call = await client.calls.create({
    to,
    from: FROM_PHONE,
    twiml: voiceResponse.toString(),
  });

  return call.sid;
};
