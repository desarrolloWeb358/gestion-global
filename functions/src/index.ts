/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import * as functions from 'firebase-functions';
import { sendSMS } from './twilio/sendSMS';

export const sendTestSMS = functions.https.onRequest(async (req, res) => {
  const to = req.query.to as string;
  const body = req.query.body as string || 'Hola desde Firebase + Twilio!';

  try {
    const sid = await sendSMS(to, body);
    res.status(200).send(`Mensaje enviado: ${sid}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error enviando el mensaje.');
  }
});

export const helloWorld = onRequest((req, res) => {
    logger.info("Hello logs!", { structuredData: true });
    res.send("¡Hola desde Firebase Functions con TypeScript!");
  });
