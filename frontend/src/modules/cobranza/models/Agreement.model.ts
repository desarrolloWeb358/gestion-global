export interface AgreementMetadata {
  tipo: 'fijo' | 'variable';       // Tipo de cuotas
  porcentajeHonorarios: number;    // % de honorarios a aplicar
  valor_total_acordado: number;    // Monto total acordado (capital + honorarios)
}

export interface Cuota {
  numero_cuota: number;      // No. CUOTAS
  fecha_pago: string;        // FECHA DE PAGOS (o Timestamp, según prefieras)
  deuda_capital: number;     // DEUDA CAPITAL
  cuota_capital: number;     // CUOTA CAPITAL
  deuda_honorarios: number;  // DEUDA HONORARIOS
  cuota_honorarios: number;  // CUOTA HONORARIOS
  cuota_acuerdo: number;     // CUOTA ACUERDO
}