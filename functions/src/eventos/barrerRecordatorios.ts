// Barrido de la cola de recordatorios del calendario.
//
// Costo: ~8.640 ejecuciones/mes (0,4% de la capa gratuita de invocaciones) y una
// sola lectura de Firestore cuando no hay nada pendiente, porque la consulta va
// contra la cola indexada y no contra la coleccion de eventos. Cambiar el
// intervalo a 30 minutos no ahorraria nada medible y volveria inutil cualquier
// recordatorio configurado a menos de una hora.

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN,
  GMAIL_USER,
} from "../notificaciones/sendEmail";
import {
  enviarAviso,
  eventoDesdeDoc,
  type CanalAviso,
  type ParticipanteAviso,
} from "./avisos";

const COLA = "recordatoriosEventos";

/** Tope por ejecucion. Con barridos cada 5 min sobra de largo. */
const MAX_POR_BARRIDO = 50;

/** Reintentos antes de rendirse con un aviso. */
const MAX_INTENTOS = 3;

/**
 * Si el aviso lleva mas de 2 horas vencido, algo estuvo caido. Enviarlo tarde es
 * peor que no enviarlo: nadie quiere "tu reunion empieza en 30 minutos" cuando
 * ya termino.
 */
const VENTANA_MAXIMA_MS = 2 * 60 * 60 * 1000;

/** Cuanto se conserva un aviso ya consumido, para poder auditarlo. */
const RETENCION_DIAS = 30;

/**
 * Purga los avisos ya consumidos. Va montada sobre el mismo barrido en lugar de
 * un job propio: un cuarto job de Cloud Scheduler saldria del cupo gratuito de 3
 * y esto solo necesita correr una vez al dia.
 */
async function purgarAntiguos(db: admin.firestore.Firestore): Promise<number> {
  const corte = admin.firestore.Timestamp.fromMillis(
    Date.now() - RETENCION_DIAS * 24 * 60 * 60 * 1000
  );

  const viejos = await db
    .collection(COLA)
    .where("enviado", "==", true)
    .where("enviarEn", "<=", corte)
    .limit(300)
    .get();

  if (viejos.empty) return 0;

  const lote = db.batch();
  viejos.docs.forEach((d) => lote.delete(d.ref));
  await lote.commit();
  return viejos.size;
}

interface DatosCola {
  eventoId: string;
  eventoTitulo?: string;
  participanteUid: string;
  canal: CanalAviso;
  minutosAntes?: number;
  enviarEn: admin.firestore.Timestamp;
  enviado: boolean;
  intentos?: number;
}

export const barrerRecordatoriosEventos = onSchedule(
  {
    schedule: "*/5 * * * *",
    timeZone: "America/Bogota",
    region: "us-central1",
    secrets: [GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN],
  },
  async () => {
    const db = admin.firestore();
    const ahora = admin.firestore.Timestamp.now();

    // Una vez al dia, en el barrido de las 3:00 a. m. hora Colombia. Los minutos
    // se leen en UTC porque Colombia es UTC-5 exacto y sin horario de verano: el
    // minuto coincide, solo cambia la hora.
    const horaBogota = Number.parseInt(
      new Date().toLocaleString("en-US", { timeZone: "America/Bogota", hour: "2-digit", hour12: false }),
      10
    );
    if (horaBogota === 3 && new Date().getUTCMinutes() < 5) {
      const purgados = await purgarAntiguos(db);
      if (purgados > 0) logger.info(`[barrerRecordatorios] Purgados ${purgados} aviso(s) antiguos`);
    }

    const snap = await db
      .collection(COLA)
      .where("enviado", "==", false)
      .where("enviarEn", "<=", ahora)
      .orderBy("enviarEn", "asc")
      .limit(MAX_POR_BARRIDO)
      .get();

    if (snap.empty) return;

    logger.info(`[barrerRecordatorios] ${snap.size} aviso(s) pendiente(s)`);

    // Los eventos se cachean dentro del barrido: varios participantes del mismo
    // evento comparten instante de envio y no hace falta releerlo por cada uno.
    const cacheEventos = new Map<string, FirebaseFirestore.DocumentData | null>();

    async function leerEvento(eventoId: string) {
      if (cacheEventos.has(eventoId)) return cacheEventos.get(eventoId)!;
      const doc = await db.doc(`eventos/${eventoId}`).get();
      const data = doc.exists ? doc.data()! : null;
      cacheEventos.set(eventoId, data);
      return data;
    }

    let enviados = 0;
    let descartados = 0;
    let fallidos = 0;

    for (const docSnap of snap.docs) {
      const datos = docSnap.data() as DatosCola;

      try {
        // Reclama el documento antes de enviar. Si dos ejecuciones se solapan
        // (un barrido lento y el siguiente ya arrancando), solo una gana.
        const reclamado = await db.runTransaction(async (tx) => {
          const actual = await tx.get(docSnap.ref);
          if (!actual.exists || actual.data()?.enviado === true) return false;
          tx.update(docSnap.ref, {
            enviado: true,
            intentos: admin.firestore.FieldValue.increment(1),
            reclamadoEn: admin.firestore.FieldValue.serverTimestamp(),
          });
          return true;
        });

        if (!reclamado) continue;

        const intentos = (datos.intentos ?? 0) + 1;

        // Aviso rancio: se marca consumido sin enviarlo.
        if (ahora.toMillis() - datos.enviarEn.toMillis() > VENTANA_MAXIMA_MS) {
          await docSnap.ref.update({ error: "Descartado: la ventana de envio ya vencio" });
          descartados++;
          continue;
        }

        const eventoData = await leerEvento(datos.eventoId);

        if (!eventoData) {
          await docSnap.ref.update({ error: "Descartado: el evento ya no existe" });
          descartados++;
          continue;
        }
        if (eventoData.estado === "cancelado") {
          await docSnap.ref.update({ error: "Descartado: el evento fue cancelado" });
          descartados++;
          continue;
        }

        const participante: ParticipanteAviso | undefined = (eventoData.participantes ?? [])
          .filter((p: any) => p?.uid === datos.participanteUid)
          .map((p: any) => ({
            uid: p.uid,
            nombre: p.nombre || "Companero",
            email: p.email ?? null,
            telefono: p.telefono ?? null,
          }))[0];

        if (!participante) {
          await docSnap.ref.update({ error: "Descartado: el participante ya no esta invitado" });
          descartados++;
          continue;
        }

        const resultado = await enviarAviso(
          datos.canal,
          participante,
          eventoDesdeDoc(datos.eventoId, eventoData),
          "recordatorio",
          datos.minutosAntes
        );

        if (resultado.ok) {
          await docSnap.ref.update({
            error: null,
            enviadoEn: admin.firestore.FieldValue.serverTimestamp(),
          });
          enviados++;
          continue;
        }

        // Omitido = no hay nada que reintentar (sin correo, canal apagado...).
        if (resultado.omitido || intentos >= MAX_INTENTOS) {
          await docSnap.ref.update({ error: resultado.motivo ?? "Error desconocido" });
          descartados++;
          continue;
        }

        // Error transitorio: se libera para que el proximo barrido lo reintente.
        await docSnap.ref.update({ enviado: false, error: resultado.motivo ?? "Error desconocido" });
        fallidos++;
      } catch (err: any) {
        logger.error("[barrerRecordatorios] Error procesando aviso", {
          id: docSnap.id,
          eventoId: datos.eventoId,
          error: err?.message ?? String(err),
        });
        fallidos++;
      }
    }

    logger.info("[barrerRecordatorios] Barrido completado", {
      total: snap.size,
      enviados,
      descartados,
      fallidos,
    });
  }
);
