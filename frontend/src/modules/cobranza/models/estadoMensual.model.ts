export interface EstadoMensual {
  id?: string;
  mes: string;  // formato "AAAA-MM"
  
  deuda: number;    
  honorarios?: number;
  recaudo?: number;

  comprobante?: number; 
  recibo? : string;
  observaciones?: string;
  tipo: 'ordinario' | 'extraordinario' | 'anticipo';

}
