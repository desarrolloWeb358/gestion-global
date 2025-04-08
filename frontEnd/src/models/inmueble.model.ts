export interface Inmueble {
    id?: string;
    torre?: string;
    apartamento?: string;
    casa?: string;
    responsable: string;
    tipificacion: string; // 'ACUERDO', 'GESTIONANDO', etc.
    deuda_total: number;
    correos: string[];
    telefonos: string[];
    acuerdo_pago?: {
      numero: string;
      fecha_acuerdo: string;
      caracteristicas: string;
      tipo: 'fijo' | 'variable';
      valor_total_acordado: number;
      cuotas: {
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
  }
  