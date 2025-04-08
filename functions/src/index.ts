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

import fetch from 'node-fetch';

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


  export const consultarRut = functions.https.onRequest(async (req, res) => {
    // Habilitar CORS manualmente
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
  
    // Si es una solicitud preflight OPTIONS, respondemos y terminamos
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
  
    try {
      const consulta: string = req.body.consulta;
      console.log("Consulta recibida:", consulta);
  
      const response = await fetch("https://muisca.dian.gov.co/WebArancel/DefConsultaNomenclaturaPorCriterio.faces", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: consulta,
      });
  
      const text = await response.text();
      res.status(200).send(text);
    } catch (error) {
      console.error("Error en consulta a DIAN:", error);
      res.status(500).send("Error consultando datos");
    }
  });