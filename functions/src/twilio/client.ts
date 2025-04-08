import { Twilio } from 'twilio';
import * as dotenv from 'dotenv';
dotenv.config();

export const twilioClient = new Twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);
