export interface EstadoMensual {
  id?: string;
  mes: string;  // formato "AAAA-MM"
  
  deuda: number;    
  recaudo?: number;
  porcentajeHonorarios?: number; 
  honorariosDeuda?: number;
  honorariosRecaudo?: number;

  recibo?: string | null;
  observaciones?: string | null;

}
