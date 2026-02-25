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

  recibo?: string | null;
  observaciones?: string | null;

}
