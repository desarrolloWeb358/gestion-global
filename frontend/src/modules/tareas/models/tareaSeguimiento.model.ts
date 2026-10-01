// modules/tareas/models/tareaSeguimiento.model.ts
//
// Ruta: tareas/{tareaId}/seguimientos/{id}
//
// Bitácora de avance de la tarea: solo texto, se va acumulando (no se edita
// ni se borra). Solo puede crear entradas quien tiene la tarea asignada.
import { Timestamp, FieldValue } from "firebase/firestore";

export interface TareaSeguimiento {
  id?: string;
  texto: string;
  creadoPor: string;
  creadoPorNombre?: string;
  fecha: Timestamp | FieldValue;
}
