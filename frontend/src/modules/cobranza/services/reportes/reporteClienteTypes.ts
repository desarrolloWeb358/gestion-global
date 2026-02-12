// src/modules/cobranza/services/reportes/reporteClienteTypes.ts

export type ResumenTipificacionRow = {
  tipificacion: string;
  inmuebles: number;
  recaudoTotal: number;
  porRecuperar: number;
};

export type RecaudoMensualRow = {
  mesLabel: string;
  total: number;
};

export type DetalleTipRow = {
  ubicacion: string;
  nombre: string;
  recaudoTotal: number;
  porRecuperar: number;
};

export type SeguimientoItem = {
  fecha: string | null; // dd/mm/aaaa o null
  texto: string;
};

export type DemandaWordItem = {
  ubicacion: string;
  demandados: string;
  numeroRadicado?: string;
  juzgado?: string;
  observacionCliente?: string;
  seguimientos: SeguimientoItem[];
};

export type DetallePorTipificacionWord = {
  tipificacion: string;
  inmuebles: number;
  recaudoTotal: number;
  porRecuperar: number;
  detalle: DetalleTipRow[];
  totalesDetalle: { inmuebles: number; recaudoTotal: number; porRecuperar: number };
};

export type ReporteClienteInput = {
  ciudad?: string;
  fechaGeneracion?: Date;
  clienteNombre?: string;
  administrador?: string;
  firmaNombre?: string;
  yearTabla?: number;
  monthTabla?: number;

  resumenTipificacion: ResumenTipificacionRow[];
  totalesResumen: { inmuebles: number; recaudoTotal: number; porRecuperar: number };

  recaudosMensuales: RecaudoMensualRow[];

  detallePorTipificacion?: DetallePorTipificacionWord[];
  demandas?: DemandaWordItem[];

  pieChartPngDataUrl?: string;
  barChartPngDataUrl?: string;

  pieChartSize?: { width: number; height: number };
  barChartSize?: { width: number; height: number };
};
