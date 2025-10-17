export interface EstadoMensual {
  id?: string;
  mes: string;  // formato "AAAA-MM"
  
  deuda: number;    
  recaudo?: number;
  acuerdo?: number;
  porcentajeHonorarios?: number; 
  honorariosDeuda?: number;
  honorariosAcuerdo?: number;

  recibo?: string | null;
  observaciones?: string | null;

}
