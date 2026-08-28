import { Timestamp, FieldValue } from "firebase/firestore";

export type EventoModalidad = "presencial" | "virtual" | "hibrida";
export type EventoEstado = "programado" | "cancelado" | "realizado";
export type EventoVisibilidad = "publica" | "privada";
export type EventoCategoria =
  | "reunion"
  | "capacitacion"
  | "audiencia"
  | "visita"
  | "normalizacion"
  | "notificacion"
  | "juzgado"
  | "permiso"
  | "otro";

/** Canales por los que se avisa a un participante. */
export type CanalAviso = "app" | "email" | "whatsapp";

/**
 * Asistencia del participante. No hay estado "pendiente": agendar a alguien
 * equivale a que asiste. Solo se registra la excepción, cuando avisa que no
 * podrá ir.
 */
export type RespuestaParticipante = "asiste" | "rechazo";

export interface ParticipanteEvento {
  uid: string;
  nombre: string;
  email: string;
  /** E.164. Solo se llena si el usuario tiene telefonoUsuario normalizable. */
  telefono?: string | null;
  respuesta: RespuestaParticipante;
  respondidoEn?: Timestamp | null;
  /** Motivo opcional cuando avisa que no podrá asistir. */
  motivoRechazo?: string | null;
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
  /**
   * Siempre viene poblado, incluso cuando el usuario no definió hora final: en
   * ese caso vale inicio + 30 min, para que el calendario pueda dibujar el
   * bloque y las validaciones de cruce tengan un rango con el que trabajar.
   */
  fin: Timestamp;
  /**
   * Si es false, la hora final es implícita y no se muestra en ninguna parte.
   * Ausente = true, para no cambiar los eventos creados antes de esta opción.
   */
  tieneHoraFin: boolean;
  todoElDia: boolean;

  estado: EventoEstado;
  visibilidad: EventoVisibilidad;

  organizadorId: string;
  organizadorNombre: string;

  participantes: ParticipanteEvento[];
  /** Denormalizado: permite `array-contains` (no se puede consultar dentro de objetos). */
  participantesUids: string[];

  /**
   * Canales del aviso inmediato: el que sale al agendar, al reprogramar y al
   * cancelar. Es independiente de `recordatorios`, que son los avisos previos.
   * Vacío = no se avisa a nadie en el momento (útil para armar la agenda sin
   * molestar); los recordatorios igual salen.
   */
  canalesAviso: CanalAviso[];

  recordatorios: RecordatorioEvento[];

  /**
   * Vínculos opcionales con el dominio. Ninguno es obligatorio.
   *
   * `clienteId` es el conjunto al que pertenece el evento. Se guarda junto con
   * `clienteNombre` denormalizado para poder listar sin resolver el documento,
   * y existe para que a futuro se pueda responder "cuántas reuniones se
   * hicieron con este conjunto" con un `where("clienteId", "==", ...)`.
   */
  clienteId?: string | null;
  clienteNombre?: string | null;
  tareaId?: string | null;

  /**
   * Trazabilidad: quién creó el evento. Se escribe una sola vez al crear y no
   * lo tocan las ediciones posteriores. Es también la única persona (junto con
   * el organizador, que hoy es la misma) autorizada a editarlo o borrarlo.
   */
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
