import { Timestamp, FieldValue } from "firebase/firestore";

export type TareaEstado = "pendiente" | "en_curso" | "finalizada";
export type TareaPrioridad = "baja" | "media" | "alta";

export interface Tarea {
  id?: string;

  titulo: string;
  descripcion?: string;
  prioridad: TareaPrioridad;
  estado: TareaEstado;
  fechaLimite?: Timestamp | null;

  asignadoA: string;
  asignadoNombre?: string;

  creadoPor: string;
  creadoPorNombre?: string;

  fechaCreacion: Timestamp | FieldValue;
  fechaActualizacion: Timestamp | FieldValue;
  fechaFinalizacion?: Timestamp | null;
}
