export interface Abono {
  id?: string;
  monto: number;
  fecha: string;
  comprobante?: number; 
  recibo? : string;
  observaciones?: string;
  tipo: 'ordinario' | 'extraordinario' | 'anticipo';
}
