export interface EstadoMensual {
  id?: string;
  mes: string;  // formato "AAAA-MM"
  
  deuda: number;    
  honorarios?: number;
  recaudo?: number;
  porcentajeHonorarios?: number; 

  comprobante?: number | string | null;
  recibo?: string | null;
  observaciones?: string | null;

}
