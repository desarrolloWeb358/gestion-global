// src/models/Agreement.model.ts
export interface Agreement {
  /** Identificador único del acuerdo */
  numero: string;
  /** Fecha en formato ISO (YYYY-MM-DD) en que se pacta el acuerdo */
  fecha_acuerdo: string;
  /** Descripción o condiciones particulares del acuerdo */
  caracteristicas: string;
  /** Tipo de acuerdo: fijo o variable */
  tipo: 'fijo' | 'variable';
  /** Porcentaje de honorarios aplicado */
  porcentajeHonorarios?: number;
  /** Valor total acordado a pagar */
  valor_total_acordado: number;
  /** Detalle del cronograma de cuotas */
  cuotas: Array<{
    /** Número secuencial de la cuota */
    numero_cuota: number;
    /** Saldo de deuda de capital antes de esta cuota */
    deuda_capital: number;
    /** Monto de cuota de capital */
    cuota_capital: number;
    /** Saldo de deuda de honorarios antes de esta cuota */
    deuda_honorarios: number;
    /** Monto de cuota de honorarios */
    cuota_honorarios: number;
    /** Monto total a pagar (capital + honorarios) */
    cuota_acuerdo: number;
    /** Fecha límite de pago de la cuota (ISO) */
    fecha_limite?: string;
    /** Observaciones del estado de la cuota */
    observacion?: string;
    /** Marca si la cuota ha sido pagada */
    pagado?: boolean;
  }>;
}
