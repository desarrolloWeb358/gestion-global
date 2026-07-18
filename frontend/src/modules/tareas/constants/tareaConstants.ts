import type { TareaEstado, TareaPrioridad } from "../models/tarea.model";

export const TAREA_ESTADOS: { id: TareaEstado; titulo: string }[] = [
  { id: "pendiente", titulo: "Pendiente" },
  { id: "en_curso", titulo: "En curso" },
  { id: "finalizada", titulo: "Finalizada" },
];

export const TAREA_PRIORIDAD_LABELS: Record<TareaPrioridad, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
};

// Clases Tailwind para el badge de prioridad en la tarjeta
export const TAREA_PRIORIDAD_BADGE_CLASS: Record<TareaPrioridad, string> = {
  baja: "bg-emerald-100 text-emerald-700 border-emerald-200",
  media: "bg-amber-100 text-amber-700 border-amber-200",
  alta: "bg-rose-100 text-rose-700 border-rose-200",
};
