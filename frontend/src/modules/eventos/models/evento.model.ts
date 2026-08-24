import { Timestamp, FieldValue } from "firebase/firestore";

export type EventoModalidad = "presencial" | "virtual" | "hibrida";
export type EventoEstado = "programado" | "cancelado" | "realizado";
export type EventoVisibilidad = "publica" | "privada";
export type EventoCategoria =
  | "reunion"
  | "capacitacion"
  | "audiencia"
  | "visita"
  | "otro";

/** Canales por los que se avisa a un participante. */
export type CanalAviso = "app" | "email" | "whatsapp";

/** Respuesta del participante a la invitación (RSVP). */
export type RespuestaParticipante = "pendiente" | "acepto" | "rechazo";

export interface ParticipanteEvento {
  uid: string;
  nombre: string;
  email: string;
  /** E.164. Solo se llena si el usuario tiene telefonoUsuario normalizable. */
  telefono?: string | null;
  respuesta: RespuestaParticipante;
  respondidoEn?: Timestamp | null;
}

/**
 * Una regla de recordatorio del evento. El trigger de backend la expande a un
 * documento por participante y por canal en `recordatoriosEventos`.
 */
export interface RecordatorioEvento {
  minutosAntes: number;
  canales: CanalAviso[];
}

export interface Evento {
  id?: string;

  titulo: string;
  descripcion?: string;
  categoria: EventoCategoria;

  modalidad: EventoModalidad;
  /** Dirección física — presencial e híbrida. */
  ubicacion?: string;
  /** Enlace de Meet/Zoom/Teams — virtual e híbrida. */
  enlaceReunion?: string;

  inicio: Timestamp;
  fin: Timestamp;
  todoElDia: boolean;

  estado: EventoEstado;
  visibilidad: EventoVisibilidad;

  organizadorId: string;
  organizadorNombre: string;

  participantes: ParticipanteEvento[];
  /** Denormalizado: permite `array-contains` (no se puede consultar dentro de objetos). */
  participantesUids: string[];

  recordatorios: RecordatorioEvento[];

  /** Vínculos opcionales con el dominio. Ninguno es obligatorio. */
  clienteId?: string | null;
  clienteNombre?: string | null;
  tareaId?: string | null;

  creadoPor: string;
  creadoPorNombre?: string;
  fechaCreacion: Timestamp | FieldValue;
  fechaActualizacion: Timestamp | FieldValue;
}

/**
 * Cola que barre el scheduler cada 5 minutos. Un documento = un aviso concreto
 * (un participante, un canal, un instante). La escribe el trigger de backend,
 * nunca el navegador.
 */
export interface RecordatorioProgramado {
  id?: string;
  eventoId: string;
  eventoTitulo: string;
  participanteUid: string;
  canal: CanalAviso;
  minutosAntes: number;
  enviarEn: Timestamp;
  enviado: boolean;
  intentos: number;
  error?: string | null;
  creadoEn: Timestamp | FieldValue;
}
