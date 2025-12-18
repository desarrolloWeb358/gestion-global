import { Timestamp } from "firebase/firestore";

export type EstadoAcuerdoPago = "activo" | "cumplido" | "incumplido" | "cancelado";

export type Periodicidad = "mensual" | "quincenal" | "semanal";

export interface CuotaAcuerdo {
  numero: number;

  // vencimiento acordado
  fechaVencimiento: Timestamp;

  // valores acordados (tabla)
  valorCuota: number;
  capitalCuota: number;
  honorariosCuota: number;

  // saldos para mostrar tabla
  capitalSaldoAntes: number;
  capitalSaldoDespues: number;
  honorariosSaldoAntes: number;
  honorariosSaldoDespues: number;

  // control (no es pago real; es estado del acuerdo)
  estado: "pendiente" | "parcial" | "pagada" | "vencida";
  pagadoAcuerdo?: number; // opcional para futuro (si aplicas estadosMensuales a cuotas)
  observacion?: string;
}

export interface AcuerdoPago {
  id?: string;

  numero: string; // ACU-2025-001
  fechaAcuerdo: Timestamp;

  porcentajeHonorarios: number; // 15 / 20 etc.
  capitalInicial: number;       // deuda capital acordada
  honorariosInicial: number;    // capitalInicial * %/100
  totalAcordado: number;        // capitalInicial + honorariosInicial

  numeroCuotas: number;
  periodicidad: Periodicidad;
  fechaPrimeraCuota: Timestamp;

  detalles?: string;
  observaciones?: string;

  estado: EstadoAcuerdoPago;

  // soportes
  archivoUrl?: string;

  // metadata
  creadoPor?: string;
  fechaCreacion?: Timestamp;
  actualizadoPor?: string;
  fechaActualizacion?: Timestamp;

  // “puntero” útil para UI/alertas (opcional)
  cuotaSiguienteNumero?: number;
}

export interface HistorialAcuerdoPago extends AcuerdoPago {
  historialId?: string;
  version: number;
  motivoCambio?: string;
  fechaGuardado: Timestamp;
  guardadoPor?: string;
}
