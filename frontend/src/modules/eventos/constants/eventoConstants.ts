import type {
  CanalAviso,
  EventoCategoria,
  EventoEstado,
  EventoModalidad,
  RecordatorioEvento,
  RespuestaParticipante,
} from "../models/evento.model";

export const EVENTO_CATEGORIAS: { id: EventoCategoria; label: string }[] = [
  { id: "reunion", label: "Reunión" },
  { id: "capacitacion", label: "Capacitación" },
  { id: "audiencia", label: "Audiencia / Diligencia" },
  { id: "visita", label: "Visita a conjunto" },
  { id: "otro", label: "Otro" },
];

export const EVENTO_CATEGORIA_LABELS: Record<EventoCategoria, string> =
  Object.fromEntries(
    EVENTO_CATEGORIAS.map((c) => [c.id, c.label])
  ) as Record<EventoCategoria, string>;

/** Color de la barra del evento en el calendario. */
export const EVENTO_CATEGORIA_COLOR: Record<EventoCategoria, string> = {
  reunion: "#2563eb",      // azul
  capacitacion: "#7c3aed", // violeta
  audiencia: "#dc2626",    // rojo
  visita: "#059669",       // verde
  otro: "#64748b",         // gris
};

export const EVENTO_MODALIDADES: { id: EventoModalidad; label: string }[] = [
  { id: "presencial", label: "Presencial" },
  { id: "virtual", label: "Virtual" },
  { id: "hibrida", label: "Híbrida" },
];

export const EVENTO_MODALIDAD_LABELS: Record<EventoModalidad, string> = {
  presencial: "Presencial",
  virtual: "Virtual",
  hibrida: "Híbrida",
};

export const EVENTO_ESTADO_LABELS: Record<EventoEstado, string> = {
  programado: "Programado",
  cancelado: "Cancelado",
  realizado: "Realizado",
};

export const CANAL_LABELS: Record<CanalAviso, string> = {
  app: "En la plataforma",
  email: "Correo",
  whatsapp: "WhatsApp",
};

export const RESPUESTA_LABELS: Record<RespuestaParticipante, string> = {
  pendiente: "Sin responder",
  acepto: "Asiste",
  rechazo: "No asiste",
};

export const RESPUESTA_BADGE_CLASS: Record<RespuestaParticipante, string> = {
  pendiente: "bg-slate-100 text-slate-700 border-slate-200",
  acepto: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rechazo: "bg-rose-100 text-rose-700 border-rose-200",
};

/** Opciones del selector "avisar con antelación". */
export const OPCIONES_ANTELACION: { minutos: number; label: string }[] = [
  { minutos: 10, label: "10 minutos antes" },
  { minutos: 30, label: "30 minutos antes" },
  { minutos: 60, label: "1 hora antes" },
  { minutos: 180, label: "3 horas antes" },
  { minutos: 1440, label: "1 día antes" },
  { minutos: 2880, label: "2 días antes" },
  { minutos: 10080, label: "1 semana antes" },
];

export function etiquetaAntelacion(minutos: number): string {
  const opcion = OPCIONES_ANTELACION.find((o) => o.minutos === minutos);
  if (opcion) return opcion.label;
  if (minutos % 1440 === 0) return `${minutos / 1440} día(s) antes`;
  if (minutos % 60 === 0) return `${minutos / 60} hora(s) antes`;
  return `${minutos} minutos antes`;
}

/** Lo que trae un evento nuevo si el usuario no toca nada. */
export const RECORDATORIOS_POR_DEFECTO: RecordatorioEvento[] = [
  { minutosAntes: 1440, canales: ["app", "email"] },
  { minutosAntes: 30, canales: ["app"] },
];

/** Duración por defecto de un evento creado con un clic en el calendario. */
export const DURACION_DEFECTO_MINUTOS = 60;

/**
 * La agenda se maneja en bloques de media hora: es el paso de los selectores de
 * hora del formulario y el tamaño de la franja en las vistas Semana y Día.
 */
export const PASO_HORA_MINUTOS = 30;
export const PASO_HORA_SEGUNDOS = PASO_HORA_MINUTOS * 60;
export const PASO_HORA_FULLCALENDAR = "00:30:00";

export const ZONA_HORARIA = "America/Bogota";
