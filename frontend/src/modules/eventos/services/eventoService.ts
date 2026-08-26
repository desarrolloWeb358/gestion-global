import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
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
  CanalAviso,
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

/**
 * Los primeros eventos de prueba se guardaron con el esquema anterior
 * ("pendiente" / "acepto"). Se normaliza al leer para no tener que migrar.
 */
function normalizarParticipantes(lista: any): ParticipanteEvento[] {
  if (!Array.isArray(lista)) return [];
  return lista.map((p: any) => ({
    ...p,
    respuesta: p?.respuesta === "rechazo" ? "rechazo" : "asiste",
  }));
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
    // Ausente = true: los eventos previos a esta opcion si tenian hora final.
    tieneHoraFin: data.tieneHoraFin !== false,
    todoElDia: data.todoElDia === true,
    estado: (data.estado ?? "programado") as EventoEstado,
    visibilidad: (data.visibilidad ?? "publica") as EventoVisibilidad,
    organizadorId: data.organizadorId ?? "",
    organizadorNombre: data.organizadorNombre ?? "",
    participantes: normalizarParticipantes(data.participantes),
    participantesUids: Array.isArray(data.participantesUids) ? data.participantesUids : [],
    canalesAviso: Array.isArray(data.canalesAviso)
      ? data.canalesAviso
      : (["app", "email"] as CanalAviso[]),
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
  tieneHoraFin: boolean;
  todoElDia: boolean;
  participantes: ParticipanteEvento[];
  canalesAviso: CanalAviso[];
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
    tieneHoraFin: data.tieneHoraFin,
    todoElDia: data.todoElDia,
    estado: "programado" as EventoEstado,
    // Hoy TODO evento es visible para el equipo. El campo se conserva para
    // cuando se habiliten eventos privados (ver suscribirEventos).
    visibilidad: "publica" as EventoVisibilidad,
    organizadorId: actor.uid,
    organizadorNombre: actor.nombre ?? "",
    participantes: data.participantes,
    participantesUids: data.participantes.map((p) => p.uid),
    canalesAviso: data.canalesAviso,
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
    tieneHoraFin: data.tieneHoraFin,
    todoElDia: data.todoElDia,
    participantes: data.participantes,
    participantesUids: data.participantes.map((p) => p.uid),
    canalesAviso: data.canalesAviso,
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
  opciones: { todoElDia?: boolean; defineHoraFin?: boolean } = {}
): Promise<void> {
  const patch: Record<string, any> = {
    inicio: Timestamp.fromDate(inicio),
    fin: Timestamp.fromDate(fin),
    fechaActualizacion: serverTimestamp(),
  };
  if (opciones.todoElDia !== undefined) patch.todoElDia = opciones.todoElDia;
  // Estirar el bloque en el calendario es una forma de fijar la hora final.
  if (opciones.defineHoraFin) patch.tieneHoraFin = true;
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
 * Marca que alguien no podra asistir (o revierte esa marca). Se hace en
 * transaccion porque hay que leer el arreglo de participantes, cambiar un
 * elemento y volverlo a escribir: dos personas respondiendo a la vez se
 * pisarian la respuesta.
 */
export async function cambiarAsistencia(
  eventoId: string,
  uid: string,
  respuesta: RespuestaParticipante,
  motivo?: string
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ref = docRef(eventoId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("El evento ya no existe.");

    const participantes: ParticipanteEvento[] = Array.isArray(snap.data().participantes)
      ? snap.data().participantes
      : [];

    const indice = participantes.findIndex((p) => p.uid === uid);
    if (indice === -1) throw new Error("No estas en la lista de este evento.");

    const actualizados = [...participantes];
    actualizados[indice] = {
      ...actualizados[indice],
      respuesta,
      respondidoEn: Timestamp.now(),
      motivoRechazo: respuesta === "rechazo" ? motivo?.trim() || null : null,
    };

    tx.update(ref, {
      participantes: actualizados,
      fechaActualizacion: serverTimestamp(),
    });
  });
}

// =====================================================
// Disponibilidad de los asistentes
// =====================================================

export interface ConflictoAgenda {
  uid: string;
  nombre: string;
  eventoId: string;
  eventoTitulo: string;
  inicio: Date;
  fin: Date;
  tieneHoraFin: boolean;
}

/** Margen hacia atras para alcanzar eventos que empezaron antes y siguen vigentes. */
const VENTANA_ATRAS_MS = 24 * 60 * 60 * 1000;

/**
 * Busca a cuales de `uids` ya se les cruza otro evento con el rango dado.
 *
 * Un evento sin hora final ocupa igual su bloque implicito de 30 minutos (asi se
 * guarda `fin`), de modo que la misma comparacion de solapamiento sirve para los
 * dos casos: hay cruce cuando `nuevoInicio < existenteFin` y
 * `existenteInicio < nuevoFin`.
 *
 * No cuenta como ocupado quien ya aviso que no asistira, ni los eventos
 * cancelados.
 */
export async function buscarConflictos(params: {
  inicio: Date;
  fin: Date;
  uids: string[];
  /** Al editar, el propio evento no debe chocar consigo mismo. */
  excluirEventoId?: string;
}): Promise<ConflictoAgenda[]> {
  const { inicio, fin, uids, excluirEventoId } = params;
  if (uids.length === 0) return [];

  // Firestore no permite un rango sobre `inicio` y a la vez array-contains-any
  // sobre otro campo, asi que se trae la franja por fecha y se cruza en memoria.
  // El volumen es de pocos eventos por dia, no hay problema de costo.
  const q = query(
    colRef(),
    where("inicio", ">=", Timestamp.fromMillis(inicio.getTime() - VENTANA_ATRAS_MS)),
    where("inicio", "<", Timestamp.fromDate(fin))
  );

  const snap = await getDocs(q);
  const buscados = new Set(uids);
  const conflictos: ConflictoAgenda[] = [];

  snap.docs.forEach((d) => {
    if (d.id === excluirEventoId) return;

    const evento = mapDocToEvento(d.id, d.data());
    if (evento.estado === "cancelado") return;

    const eventoInicio = (evento.inicio as any)?.toDate?.();
    const eventoFin = (evento.fin as any)?.toDate?.();
    if (!eventoInicio || !eventoFin) return;

    // Se solapan (el fin es exclusivo: 8-9 y 9-10 no chocan).
    if (!(inicio.getTime() < eventoFin.getTime() && eventoInicio.getTime() < fin.getTime())) {
      return;
    }

    evento.participantes.forEach((p) => {
      if (!buscados.has(p.uid) || p.respuesta === "rechazo") return;
      conflictos.push({
        uid: p.uid,
        nombre: p.nombre,
        eventoId: evento.id!,
        eventoTitulo: evento.titulo,
        inicio: eventoInicio,
        fin: eventoFin,
        tieneHoraFin: evento.tieneHoraFin,
      });
    });
  });

  return conflictos;
}

// =====================================================
// Suscripciones en tiempo real
// =====================================================

export type RangoFechas = { desde: Date; hasta: Date };

/**
 * Todo evento es hoy visible para el equipo completo, asi que basta una consulta
 * por rango de fechas y el `verTodas` deja de discriminar.
 *
 * Cuando se habiliten eventos privados habra que volver a partir esto en dos
 * suscripciones (una por `visibilidad == "publica"` y otra por
 * `participantesUids array-contains uid`) y fusionarlas por id, porque Firestore
 * no sabe hacer OR entre dos condiciones distintas. Los indices para esa
 * consulta ya estan desplegados.
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
  const { rango } = params;

  const q = query(
    colRef(),
    where("inicio", ">=", Timestamp.fromDate(rango.desde)),
    where("inicio", "<=", Timestamp.fromDate(rango.hasta))
  );

  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => mapDocToEvento(d.id, d.data()))),
    (err) => {
      console.error("[suscribirEventos] onSnapshot error:", err);
      onError?.(err);
    }
  );
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
