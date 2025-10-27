// src/modules/cobranza/models/observacionCliente.model.ts
import type { Timestamp } from "firebase/firestore";

export interface ObservacionCliente {
  id?: string;
  texto: string;                
  fecha?: Timestamp;   // guardado en Firestore
}
