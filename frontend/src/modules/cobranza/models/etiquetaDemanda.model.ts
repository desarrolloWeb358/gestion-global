// modules/cobranza/models/etiquetaDemanda.model.ts
import { FieldValue, Timestamp } from "firebase/firestore";

/**
 * Catálogo raíz de etiquetas de demanda: etiquetasDemanda/{id}.
 * Sirve para que los nombres sean consistentes y filtrables en el reporte global.
 * El detalle y la fecha concreta se guardan por demanda (ver EtiquetaEnDemanda).
 */
export interface EtiquetaDemanda {
  id?: string;
  nombre: string;
  color?: string;
  activo: boolean;
  fechaCreacion?: Timestamp | { seconds: number; nanoseconds: number } | FieldValue;
}
