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
  path?: string;
  nombre?: string;
  mime?: string;
  contentType?: string;
  size?: number;
  subidoEn?: Timestamp;
  subidoPor?: string;
}

export type FuenteRepresentantesAcuerdo = "deudor" | "demandados" | "manual";

export interface RepresentanteAcuerdo {
  nombre: string;
  numeroDocumento?: string;
  ciudadDocumento?: string;
  direccion?: string;
  celular?: string;
  email?: string;
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
  archivosAcuerdo?: ArchivoAcuerdoFirmado[];
  representantesFuente?: FuenteRepresentantesAcuerdo;
  representantes?: RepresentanteAcuerdo[];

  // Campos legados para acuerdos existentes con un solo archivo.
  acuerdoURL?: string;
  acuerdoPath?: string | null;
  acuerdoNombre?: string | null;
  acuerdoSize?: number | null;
  acuerdoMime?: string | null;

  creadoPor?: string;
  actualizadoPor?: string;
  fechaCreacion: Timestamp;
  fechaActualizacion: Timestamp;
}
