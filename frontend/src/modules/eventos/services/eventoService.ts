import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/firebase";
import { registrarEliminacion } from "@/shared/services/auditLog/auditLogService";
import type {
  Evento,
  EventoCategoria,
  EventoEstado,
  EventoModalidad,
  EventoVisibilidad,
  ParticipanteEvento,
  RecordatorioEvento,
  RespuestaParticipante,
} from "../models/evento.model";

const COLECCION = "eventos";

function colRef() {
  return collection(db, COLECCION);
}
function docRef(eventoId: string) {
  return doc(db, COLECCION, eventoId);
}

function mapDocToEvento(id: string, data: any): Evento {
  return {
    id,
    titulo: data.titulo ?? "",
    descripcion: data.descripcion ?? "",
    categoria: (data.categoria ?? "reunion") as EventoCategoria,
    modalidad: (data.modalidad ?? "presencial") as EventoModalidad,
    ubicacion: data.ubicacion ?? "",
    enlaceReunion: data.enlaceReunion ?? "",
    inicio: data.inicio,
    fin: data.fin,
    todoElDia: data.todoElDia === true,
    estado: (data.estado ?? "programado") as EventoEstado,
    visibilidad: (data.visibilidad ?? "publica") as EventoVisibilidad,
    organizadorId: data.organizadorId ?? "",
    organizadorNombre: data.organizadorNombre ?? "",
    participantes: Array.isArray(data.participantes) ? data.participantes : [],
    participantesUids: Array.isArray(data.participantesUids) ? data.participantesUids : [],
    recordatorios: Array.isArray(data.recordatorios) ? data.recordatorios : [],
    clienteId: data.clienteId ?? null,
    clienteNombre: data.clienteNombre ?? null,
    tareaId: data.tareaId ?? null,
    creadoPor: data.creadoPor ?? "",
    creadoPorNombre: data.creadoPorNombre ?? "",
    fechaCreacion: data.fechaCreacion,
    fechaActualizacion: data.fechaActualizacion,
  };
}

// =====================================================
// CRUD Evento
// =====================================================

type ActorInfo = { uid: string; nombre?: string };

export type GuardarEventoInput = {
  titulo: string;
  descripcion?: string;
  categoria: EventoCategoria;
  modalidad: EventoModalidad;
  ubicacion?: string;
  enlaceReunion?: string;
  inicio: Date;
  fin: Date;
  todoElDia: boolean;
  visibilidad: EventoVisibilidad;
  participantes: ParticipanteEvento[];
  recordatorios: RecordatorioEvento[];
  clienteId?: string | null;
  clienteNombre?: string | null;
  tareaId?: string | null;
};

/**
 * El navegador solo escribe el evento. La cola de recordatorios y los avisos de
 * invitacion los genera el trigger sincronizarEvento en el backend, igual que se
 * hizo con valores agregados, para que no dependan de que el navegador complete
 * la peticion.
 */
export async function crearEvento(
  data: GuardarEventoInput,
  actor: ActorInfo
): Promise<string> {
  const payload = {
    titulo: data.titulo.trim(),
    descripcion: data.descripcion?.trim() ?? "",
    categoria: data.categoria,
    modalidad: data.modalidad,
    ubicacion: data.ubicacion?.trim() ?? "",
    enlaceReunion: data.enlaceReunion?.trim() ?? "",
    inicio: Timestamp.fromDate(data.inicio),
    fin: Timestamp.fromDate(data.fin),
    todoElDia: data.todoElDia,
    estado: "programado" as EventoEstado,
    visibilidad: data.visibilidad,
    organizadorId: actor.uid,
    organizadorNombre: actor.nombre ?? "",
    participantes: data.participantes,
    participantesUids: data.participantes.map((p) => p.uid),
    recordatorios: data.recordatorios,
    clienteId: data.clienteId ?? null,
    clienteNombre: data.clienteNombre ?? null,
    tareaId: data.tareaId ?? null,
    creadoPor: actor.uid,
    creadoPorNombre: actor.nombre ?? "",
    fechaCreacion: serverTimestamp(),
    fechaActualizacion: serverTimestamp(),
  };

  const created = await addDoc(colRef(), payload);
  return created.id;
}

export async function actualizarEvento(
  eventoId: string,
  data: GuardarEventoInput
): Promise<void> {
  await updateDoc(docRef(eventoId), {
    titulo: data.titulo.trim(),
    descripcion: data.descripcion?.trim() ?? "",
    categoria: data.categoria,
    modalidad: data.modalidad,
    ubicacion: data.ubicacion?.trim() ?? "",
    enlaceReunion: data.enlaceReunion?.trim() ?? "",
    inicio: Timestamp.fromDate(data.inicio),
    fin: Timestamp.fromDate(data.fin),
    todoElDia: data.todoElDia,
    visibilidad: data.visibilidad,
    participantes: data.participantes,
    participantesUids: data.participantes.map((p) => p.uid),
    recordatorios: data.recordatorios,
    clienteId: data.clienteId ?? null,
    clienteNombre: data.clienteNombre ?? null,
    tareaId: data.tareaId ?? null,
    fechaActualizacion: serverTimestamp(),
  });
}

/** Mover o redimensionar desde el calendario. No toca el resto del evento. */
export async function reprogramarEvento(
  eventoId: string,
  inicio: Date,
  fin: Date,
  todoElDia?: boolean
): Promise<void> {
  const patch: Record<string, any> = {
    inicio: Timestamp.fromDate(inicio),
    fin: Timestamp.fromDate(fin),
    fechaActualizacion: serverTimestamp(),
  };
  if (todoElDia !== undefined) patch.todoElDia = todoElDia;
  await updateDoc(docRef(eventoId), patch);
}

/**
 * Cancelar es preferible a borrar: conserva el historico y dispara el aviso de
 * cancelacion a los participantes.
 */
export async function cambiarEstadoEvento(
  eventoId: string,
  estado: EventoEstado
): Promise<void> {
  await updateDoc(docRef(eventoId), {
    estado,
    fechaActualizacion: serverTimestamp(),
  });
}

export async function eliminarEvento(
  eventoId: string,
  titulo?: string
): Promise<void> {
  await deleteDoc(docRef(eventoId));
  await registrarEliminacion({
    modulo: "evento",
    descripcion: titulo ?? eventoId,
    coleccionPath: COLECCION,
  });
}

/**
 * RSVP. Se hace en transaccion porque hay que leer el arreglo de participantes,
 * cambiar un elemento y volverlo a escribir: dos personas respondiendo a la vez
 * se pisarian la respuesta.
 */
export async function responderInvitacion(
  eventoId: string,
  uid: string,
  respuesta: RespuestaParticipante
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = docRef(eventoId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("El evento ya no existe.");

    const participantes: ParticipanteEvento[] = Array.isArray(snap.data().participantes)
      ? snap.data().participantes
      : [];

    const indice = participantes.findIndex((p) => p.uid === uid);
    if (indice === -1) throw new Error("No estas invitado a este evento.");

    const actualizados = [...participantes];
    actualizados[indice] = {
      ...actualizados[indice],
      respuesta,
      respondidoEn: Timestamp.now(),
    };

    tx.update(ref, {
      participantes: actualizados,
      fechaActualizacion: serverTimestamp(),
    });
  });
}

// =====================================================
// Suscripciones en tiempo real
// =====================================================

export type RangoFechas = { desde: Date; hasta: Date };

/**
 * Firestore no sabe hacer OR entre "es publica" y "estoy invitado", asi que se
 * abren dos suscripciones y se fusionan por id. Quien administra usa una sola
 * consulta por rango porque lo ve todo.
 */
export function suscribirEventos(
  params: {
    uid: string;
    verTodas: boolean;
    rango: RangoFechas;
  },
  callback: (eventos: Evento[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const { uid, verTodas, rango } = params;
  const desde = Timestamp.fromDate(rango.desde);
  const hasta = Timestamp.fromDate(rango.hasta);

  if (verTodas) {
    const q = query(colRef(), where("inicio", ">=", desde), where("inicio", "<=", hasta));
    return onSnapshot(
      q,
      (snap) => callback(snap.docs.map((d) => mapDocToEvento(d.id, d.data()))),
      (err) => {
        console.error("[suscribirEventos] onSnapshot error:", err);
        onError?.(err);
      }
    );
  }

  const porVisibilidad = new Map<string, Evento>();
  const porInvitacion = new Map<string, Evento>();

  function emitir() {
    const fusionados = new Map<string, Evento>();
    porVisibilidad.forEach((e, id) => fusionados.set(id, e));
    porInvitacion.forEach((e, id) => fusionados.set(id, e));
    callback([...fusionados.values()]);
  }

  const manejarError = (etiqueta: string) => (err: unknown) => {
    console.error(`[suscribirEventos:${etiqueta}] onSnapshot error:`, err);
    onError?.(err);
  };

  const unsubPublicos = onSnapshot(
    query(
      colRef(),
      where("visibilidad", "==", "publica"),
      where("inicio", ">=", desde),
      where("inicio", "<=", hasta)
    ),
    (snap) => {
      porVisibilidad.clear();
      snap.docs.forEach((d) => porVisibilidad.set(d.id, mapDocToEvento(d.id, d.data())));
      emitir();
    },
    manejarError("publicos")
  );

  const unsubInvitado = onSnapshot(
    query(
      colRef(),
      where("participantesUids", "array-contains", uid),
      where("inicio", ">=", desde),
      where("inicio", "<=", hasta)
    ),
    (snap) => {
      porInvitacion.clear();
      snap.docs.forEach((d) => porInvitacion.set(d.id, mapDocToEvento(d.id, d.data())));
      emitir();
    },
    manejarError("invitado")
  );

  return () => {
    unsubPublicos();
    unsubInvitado();
  };
}

/** Suscripcion a un unico evento (para el deep-link desde una notificacion). */
export function suscribirEvento(
  eventoId: string,
  callback: (evento: Evento | null) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    docRef(eventoId),
    (snap) => callback(snap.exists() ? mapDocToEvento(snap.id, snap.data()) : null),
    (err) => {
      console.error("[suscribirEvento] onSnapshot error:", err);
      onError?.(err);
    }
  );
}
