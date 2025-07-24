import { ReactNode } from "react";

// Primero definimos el tipo reutilizable de Cuota
export interface Cuota {
  acuerdo_pago: any;
  mes: ReactNode;
  valor_esperado: any;
  observacion: ReactNode;
  numero: string;
  fecha_limite: string;
  deuda_capital: number;
  cuota_capital: number;
  deuda_honorarios: number;
  honorarios: number;
  cuota_acuerdo: number;
  pagado: boolean;
}

// Ahora podemos usarlo en acuerdo_pago e historial_acuerdos
export interface deudor {
  id?: string;
   // Ubicación
  ubicacion?: string;
  tipificacion: string;

  // Identificación del responsable
  nombre: string;
  cedula: string;
    // Contacto adicional
  correos: string[];
  telefonos: string[];
  // Relación con cliente y ejecutivo
  clienteId: string;
  ejecutivoId: string;
  // Estado general
  estado: string;
  deuda_total: number;
  historial_acuerdos?: {
    numero: string;
    fecha_acuerdo: string;
    caracteristicas: string;
    tipo: "fijo" | "variable";
    porcentajeHonorarios?: number;
    valor_total_acordado: number;
    cuotas: Cuota[];
    archivoUrl?: string;
  }[];

 


  // Porcentaje general de honorarios
  porcentaje_honorarios?: number;

  acuerdo_pago?: {
    numero: string;
    fecha_acuerdo: string;
    caracteristicas: string;
    tipo: "fijo" | "variable";
    porcentajeHonorarios?: number;
    valor_total_acordado: number;
    cuotas: Cuota[];
  };

  recaudos: {
    [mes: string]: {
      monto: number;
      fecha: string;
      observacion?: string;
    };
  };
}
