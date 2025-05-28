// src/modules/cobranza/models/inmueble.model.ts
export interface Inmueble {
  id?: string;
  torre?: string;
  apartamento?: string;
  casa?: string;
  nombreResponsable: string;
  estado: string; // 'ACUERDO', 'GESTIONANDO', etc.
  deuda_total: number;
  correos: string[];
  telefonos: string[];
  porcentaje_honorarios?: number;
  acuerdo_pago?: {
    numero: string;
    fecha_acuerdo: string;
    caracteristicas: string;
    tipo: 'fijo' | 'variable';
    
    porcentajeHonorarios?: number;      // <-- Agregado
    valor_total_acordado: number;
    cuotas: {
      pagado: boolean;
      mes: string;
      valor_esperado: number;
      fecha_limite?: string;
      observacion?: string;
    }[];
  };
  recaudos: {
    [mes: string]: {
      monto: number;
      fecha: string;
      observacion?: string;
    };
  };
  cedulaResponsable: string;
  correoResponsable: string;
  telefonoResponsable: string;
}
