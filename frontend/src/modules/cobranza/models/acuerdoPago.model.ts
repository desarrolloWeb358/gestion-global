import { Timestamp } from "firebase/firestore";
import type { EstadoAcuerdo } from "@/shared/constants/acuerdoEstado";

export interface CuotaAcuerdo {
  numero: number;
  fechaPago: Timestamp;

  valorCuota: number;
  honorariosCuota: number;
  capitalCuota: number;

  honorariosSaldoAntes: number;
  honorariosSaldoDespues: number;
  capitalSaldoAntes: number;
  capitalSaldoDespues: number;

  pagado?: boolean;
  fechaPagoReal?: Timestamp;
  valorPagado?: number;
}

export interface ArchivoAcuerdoFirmado {
  url: string;
  nombre?: string;
  contentType?: string;
  size?: number;
  subidoEn?: Timestamp;
  subidoPor?: string;
}

export interface AcuerdoPago {
  id: string;

  numero: string;
  fechaAcuerdo: Timestamp;

  capitalInicial: number;
  porcentajeHonorarios: number;
  honorariosInicial: number;
  totalAcordado: number;

  fechaPrimeraCuota: Timestamp;
  valorCuotaBase: number;

  detalles?: string;

  estado: EstadoAcuerdo;
  esActivo: boolean;

  archivoFirmado?: ArchivoAcuerdoFirmado;

  creadoPor?: string;
  actualizadoPor?: string;
  fechaCreacion: Timestamp;
  fechaActualizacion: Timestamp;
}
