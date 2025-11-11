export type TipoSeguimientoOrigen = "prejuridico" | "juridico" | "demanda";

export interface SeguimientoReporteItem {
  id: string;
  clienteUID?: string;
  ejecutivoUID?: string;
  fechaCreacion?: Date;
  origen: TipoSeguimientoOrigen;
}

export interface ResumenEjecutivo {
  ejecutivoUID: string;
  total: number;
  prejuridico: number;
  juridico: number;
  demanda: number;
}

