// src/modules/cobranza/models/historialTipificacion.model.ts
import { Timestamp } from "firebase/firestore";

export interface HistorialTipificacion {
  id?: string;                 // id del documento en Firestore
  fecha: Timestamp;            // timestamp Firestore
  tipificacion: string;        // string (idealmente TipificacionDeuda, pero tú pediste string)
}
