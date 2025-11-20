export type FilaReporte = {
  tipificacion: string;
  inmueble: string;      // p.ej. "14-501"
  nombre: string;

  porRecaudar: number;  // deuda (campo 'deuda') del doc "YYYY-01"
  

  rec_01: number; rec_02: number; rec_03: number; rec_04: number;
  rec_05: number; rec_06: number; rec_07: number; rec_08: number;
  rec_09: number; rec_10: number; rec_11: number; rec_12: number;

  recaudoTotal: number;  // suma rec_01..rec_12
};
