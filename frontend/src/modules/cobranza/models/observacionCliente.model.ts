// src/modules/cobranza/models/observacionCliente.model.ts
import type { Timestamp } from "firebase/firestore";

export interface ObservacionCliente {
  id?: string;
  texto: string;
  fecha: Date;                  // para la UI
  fechaTs?: Timestamp | null;   // guardado en Firestore
}
