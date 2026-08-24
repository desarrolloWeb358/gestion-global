// Unico dueno de la cola de recordatorios y de los avisos inmediatos.
//
// Se dispara con cada escritura sobre eventos/{eventoId} y deja el sistema
// consistente: si el evento se movio, se cancelo o cambio de invitados, la cola
// se regenera aqui. El navegador solo escribe el evento — mismo criterio que se
// tomo en valoresAgregados/notificaciones.ts tras el incidente de correos que
// nunca salieron porque el fetch del navegador no completaba.

import { onDocumentWritten } from "firebase-functions/v2/firestore";
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
  type TipoAviso,
} from "./avisos";

const COLA = "recordatoriosEventos";
const MAX_POR_LOTE = 400;

interface ParticipanteDoc {
  uid: string;
  nombre?: string;
  email?: string | null;
  telefono?: string | null;
  respuesta?: string;
}

interface RecordatorioDoc {
  minutosAntes: number;
  canales: CanalAviso[];
}

function participantesDe(data: any): ParticipanteAviso[] {
  const lista: ParticipanteDoc[] = Array.isArray(data?.participantes) ? data.participantes : [];
  return lista
    .filter((p) => !!p?.uid)
    .map((p) => ({
      uid: p.uid,
      nombre: p.nombre || "Companero",
      email: p.email ?? null,
      telefono: p.telefono ?? null,
    }));
}

function recordatoriosDe(data: any): RecordatorioDoc[] {
  const lista = Array.isArray(data?.recordatorios) ? data.recordatorios : [];
  return lista.filter(
    (r: any) => Number.isFinite(r?.minutosAntes) && Array.isArray(r?.canales) && r.canales.length > 0
  );
}

/** Un canal sin el dato de contacto correspondiente nunca podria entregarse. */
function canalEntregable(canal: CanalAviso, participante: ParticipanteAviso): boolean {
  if (canal === "email") return !!participante.email;
  if (canal === "whatsapp") return !!participante.telefono;
  return true;
}

async function borrarPendientes(eventoId: string): Promise<number> {
  const db = admin.firestore();
  const snap = await db
    .collection(COLA)
    .where("eventoId", "==", eventoId)
    .where("enviado", "==", false)
    .get();

  if (snap.empty) return 0;

  for (let i = 0; i < snap.docs.length; i += MAX_POR_LOTE) {
    const lote = db.batch();
    snap.docs.slice(i, i + MAX_POR_LOTE).forEach((d) => lote.delete(d.ref));
    await lote.commit();
  }
  return snap.size;
}

/**
 * Expande las reglas de recordatorio a un documento por (participante, canal,
 * antelacion). Se omiten los que caerian en el pasado: no tiene sentido avisar
 * "1 dia antes" de una reunion creada esta manana.
 */
async function generarCola(eventoId: string, data: any): Promise<number> {
  const db = admin.firestore();
  const inicio: Date | undefined = data?.inicio?.toDate?.();
  if (!inicio) return 0;
  if (data?.estado === "cancelado") return 0;

  const participantes = participantesDe(data);
  const recordatorios = recordatoriosDe(data);
  const titulo: string = data?.titulo ?? "Evento";
  const ahora = Date.now();

  const pendientes: FirebaseFirestore.DocumentData[] = [];

  for (const recordatorio of recordatorios) {
    const enviarEnMs = inicio.getTime() - recordatorio.minutosAntes * 60_000;
    if (enviarEnMs <= ahora) continue;

    for (const participante of participantes) {
      for (const canal of recordatorio.canales) {
        if (!canalEntregable(canal, participante)) continue;
        pendientes.push({
          eventoId,
          eventoTitulo: titulo,
          participanteUid: participante.uid,
          canal,
          minutosAntes: recordatorio.minutosAntes,
          enviarEn: admin.firestore.Timestamp.fromMillis(enviarEnMs),
          enviado: false,
          intentos: 0,
          error: null,
          creadoEn: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  }

  for (let i = 0; i < pendientes.length; i += MAX_POR_LOTE) {
    const lote = db.batch();
    pendientes.slice(i, i + MAX_POR_LOTE).forEach((payload) => {
      lote.set(db.collection(COLA).doc(), payload);
    });
    await lote.commit();
  }

  return pendientes.length;
}

/** Manda un aviso inmediato por app + correo a los destinatarios indicados. */
async function avisarAhora(
  eventoId: string,
  data: any,
  destinatarios: ParticipanteAviso[],
  tipo: TipoAviso
): Promise<void> {
  if (destinatarios.length === 0) return;
  const evento = eventoDesdeDoc(eventoId, data);

  await Promise.all(
    destinatarios.flatMap((participante) =>
      (["app", "email"] as CanalAviso[]).map(async (canal) => {
        const resultado = await enviarAviso(canal, participante, evento, tipo);
        if (!resultado.ok && !resultado.omitido) {
          logger.warn("[sincronizarEvento] Aviso inmediato fallido", {
            eventoId,
            canal,
            tipo,
            uid: participante.uid,
            motivo: resultado.motivo,
          });
        }
      })
    )
  );
}

function mismosMs(a?: Date, b?: Date): boolean {
  return (a?.getTime() ?? 0) === (b?.getTime() ?? 0);
}

export const sincronizarEvento = onDocumentWritten(
  {
    document: "eventos/{eventoId}",
    region: "us-central1",
    secrets: [GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN],
  },
  async (event) => {
    const eventoId = event.params.eventoId;
    const antes = event.data?.before?.exists ? event.data.before.data() : null;
    const despues = event.data?.after?.exists ? event.data.after.data() : null;

    // ── Borrado ────────────────────────────────────────────────
    if (!despues) {
      const borrados = await borrarPendientes(eventoId);
      logger.info("[sincronizarEvento] Evento borrado, cola limpiada", { eventoId, borrados });
      return;
    }

    const participantesDespues = participantesDe(despues);

    // ── Creacion ───────────────────────────────────────────────
    if (!antes) {
      const encolados = await generarCola(eventoId, despues);
      await avisarAhora(eventoId, despues, participantesDespues, "invitacion");
      logger.info("[sincronizarEvento] Evento creado", {
        eventoId,
        encolados,
        invitados: participantesDespues.length,
      });
      return;
    }

    // ── Actualizacion ──────────────────────────────────────────
    const inicioAntes: Date | undefined = antes.inicio?.toDate?.();
    const inicioDespues: Date | undefined = despues.inicio?.toDate?.();
    const finAntes: Date | undefined = antes.fin?.toDate?.();
    const finDespues: Date | undefined = despues.fin?.toDate?.();

    const uidsAntes = new Set<string>(
      Array.isArray(antes.participantesUids) ? antes.participantesUids : []
    );
    const uidsDespues = new Set<string>(
      Array.isArray(despues.participantesUids) ? despues.participantesUids : []
    );

    const cambioHorario = !mismosMs(inicioAntes, inicioDespues) || !mismosMs(finAntes, finDespues);
    const cambioRecordatorios =
      JSON.stringify(antes.recordatorios ?? []) !== JSON.stringify(despues.recordatorios ?? []);
    const cambioParticipantes =
      uidsAntes.size !== uidsDespues.size || [...uidsDespues].some((uid) => !uidsAntes.has(uid));
    const cambioLugar =
      antes.ubicacion !== despues.ubicacion || antes.enlaceReunion !== despues.enlaceReunion;

    const estadoAntes = antes.estado ?? "programado";
    const estadoDespues = despues.estado ?? "programado";
    const seCancelo = estadoAntes !== "cancelado" && estadoDespues === "cancelado";
    const seReactivo = estadoAntes === "cancelado" && estadoDespues === "programado";

    // Cancelacion: se avisa y la cola desaparece.
    if (seCancelo) {
      const borrados = await borrarPendientes(eventoId);
      await avisarAhora(eventoId, despues, participantesDespues, "cancelacion");
      logger.info("[sincronizarEvento] Evento cancelado", { eventoId, borrados });
      return;
    }

    // Nada relevante cambio (p. ej. alguien solo confirmo asistencia): no se toca
    // la cola ni se envia nada. Esta guarda es la que evita spam en cada RSVP.
    if (!cambioHorario && !cambioRecordatorios && !cambioParticipantes && !cambioLugar && !seReactivo) {
      return;
    }

    if (cambioHorario || cambioRecordatorios || cambioParticipantes || seReactivo) {
      await borrarPendientes(eventoId);
      await generarCola(eventoId, despues);
    }

    // A quien se le avisa que cambio algo: a todos si se movio la reunion o el
    // lugar; solo a los recien agregados si lo unico que paso es que entraron.
    if (cambioHorario || cambioLugar || seReactivo) {
      await avisarAhora(eventoId, despues, participantesDespues, "reprogramacion");
    } else if (cambioParticipantes) {
      const nuevos = participantesDespues.filter((p) => !uidsAntes.has(p.uid));
      await avisarAhora(eventoId, despues, nuevos, "invitacion");
    }

    logger.info("[sincronizarEvento] Evento actualizado", {
      eventoId,
      cambioHorario,
      cambioLugar,
      cambioRecordatorios,
      cambioParticipantes,
      seReactivo,
    });
  }
);
