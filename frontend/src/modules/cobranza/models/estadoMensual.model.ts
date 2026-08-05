/**
 * Cómo se calculan los honorarios del recaudo:
 * - "porcentaje_recaudo": % sobre el total del recaudo  → Recaudo × %/100
 * - "incluido_en_recaudo": el recaudo ya trae capital + honorarios → Recaudo × % / (100 + %)
 * - "fijo": valor digitado manualmente, sin porcentaje
 */
export type ModoHonorariosRecaudo =
  | "porcentaje_recaudo"
  | "incluido_en_recaudo"
  | "fijo";

export interface EstadoMensual {
  id?: string;
  mes: string;  // formato "AAAA-MM"

  clienteUID: string;
  deuda: number;    
  recaudo?: number;
  //acuerdo?: number;
  porcentajeHonorarios?: number; 
  honorariosDeuda?: number;
  //honorariosAcuerdo?: number | null;
  honorariosRecaudo?: number | null;
  modoHonorariosRecaudo?: ModoHonorariosRecaudo | null;

  recibo?: string | null;
  observaciones?: string | null;

}
