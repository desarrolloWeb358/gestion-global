// src/modules/cobranza/models/observacionCliente.model.ts
export interface ObservacionCliente {
  id?: string;
  texto: string;
  fecha: Date;        // para UI
  fechaTs?: any;      // Timestamp de Firestore (source of truth)

}
