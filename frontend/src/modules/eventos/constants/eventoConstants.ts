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
  asiste: "Asiste",
  rechazo: "No asiste",
};

export const RESPUESTA_BADGE_CLASS: Record<RespuestaParticipante, string> = {
  asiste: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rechazo: "bg-rose-100 text-rose-700 border-rose-200",
};

/**
 * Lugar frecuente: la mayoria de reuniones internas son en la sede, y escribir
 * la direccion cada vez es friccion pura.
 * Ajusta el texto aqui si cambia la sede.
 */
export const UBICACION_OFICINA = "Oficina Gestion Global";

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

/**
 * Un evento nuevo arranca SIN recordatorios: se agregan a mano cuando hacen
 * falta. Antes venían dos precargados y terminaban mandando avisos que nadie
 * había pedido.
 */
export const RECORDATORIOS_POR_DEFECTO: RecordatorioEvento[] = [];

/**
 * Igual con el aviso al guardar: ningún canal viene marcado. Notificar es una
 * decisión explícita de quien agenda, no algo que pase por omisión.
 */
export const CANALES_AVISO_POR_DEFECTO: CanalAviso[] = [];

/** Los tres canales, en el orden en que se muestran. */
export const CANALES: CanalAviso[] = ["app", "email", "whatsapp"];

/**
 * Bloque mínimo de un evento. También es la duración implícita cuando no se
 * define hora final, y lo que se propone al activarla.
 */
export const DURACION_MINIMA_MINUTOS = 30;

/**
 * La agenda se maneja en bloques de media hora: es el paso de los selectores de
 * hora del formulario y el tamaño de la franja en las vistas Semana y Día.
 */
export const PASO_HORA_MINUTOS = 30;
export const PASO_HORA_FULLCALENDAR = "00:30:00";

/**
 * Las 48 medias horas del dia. El formulario usa un desplegable con estas
 * opciones en vez de un <input type="time">: asi es imposible guardar un
 * evento a las 8:37, que era lo que pasaba escribiendo la hora a mano.
 */
export const OPCIONES_HORA: { valor: string; label: string }[] = Array.from(
  { length: (24 * 60) / PASO_HORA_MINUTOS },
  (_, indice) => {
    const totalMinutos = indice * PASO_HORA_MINUTOS;
    const h = Math.floor(totalMinutos / 60);
    const m = totalMinutos % 60;
    const valor = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const label = new Date(2000, 0, 1, h, m).toLocaleTimeString("es-CO", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return { valor, label };
  }
);

/** Acerca una hora cualquiera a la media hora mas proxima hacia abajo. */
export function ajustarAMediaHora(hora: string): string {
  const [h, m] = hora.split(":").map((n) => Number.parseInt(n, 10));
  if (!Number.isFinite(h)) return "08:00";
  const minutoAjustado = (m ?? 0) < PASO_HORA_MINUTOS ? 0 : PASO_HORA_MINUTOS;
  return `${String(h).padStart(2, "0")}:${String(minutoAjustado).padStart(2, "0")}`;
}

export const ZONA_HORARIA = "America/Bogota";
