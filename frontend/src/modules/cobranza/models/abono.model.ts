export interface Abono {
  id?: string;
  monto: number;
  fecha: string;
  recibo: string;
  tipo: 'ordinario' | 'extraordinario' | 'anticipo';
}
