
import { defineSecret } from "firebase-functions/params";
import { Twilio } from "twilio";

// 🔐 Definimos los secretos
export const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
export const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");

// 👇 Creamos una función para instanciar el cliente (en vez de exportar el cliente directo)
export const getTwilioClient = () => {
  return new Twilio(TWILIO_ACCOUNT_SID.value(), TWILIO_AUTH_TOKEN.value());
};






