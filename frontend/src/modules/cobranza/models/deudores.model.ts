// src/modules/cobranza/models/deudor.model.ts
import { FieldValue, Timestamp } from "firebase/firestore";
import { AcuerdoPago } from "./acuerdoPago.model";
import { EstadoMensual } from "./estadoMensual.model";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";

export interface DemandadoItem {
  nombre: string;
  numeroDocumento: string;
}

/** Convierte cualquier valor legacy (string) o nuevo (array) a DemandadoItem[] */
export function normalizeDemandados(raw: any): DemandadoItem[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    const s = raw.trim();
    return s ? [{ nombre: s, numeroDocumento: "" }] : [];
  }
  if (Array.isArray(raw)) {
    return raw.filter(Boolean).map((item: any) => ({
      nombre: String(item.nombre ?? ""),
      numeroDocumento: String(item.numeroDocumento ?? ""),
    }));
  }
  return [];
}

/** Para reportes Word y búsquedas: convierte el array a string legible */
export function demandadosToString(items: DemandadoItem[]): string {
  return items
    .filter((d) => d.nombre.trim())
    .map((d) =>
      d.numeroDocumento.trim()
        ? `${d.nombre.trim()} (Doc: ${d.numeroDocumento.trim()})`
        : d.nombre.trim()
    )
    .join(", ");
}

export interface Deudor {
    id?: string;
    uidUsuario?: string;
    ubicacion?: string;
    fechaCreacion?: Timestamp | { seconds: number; nanoseconds: number } | FieldValue;
    nombre: string;
    cedula?: string;
    correos: string[];
    telefonos: string[];
    direccion?: string;
    tipificacion: TipificacionDeuda;
    porcentajeHonorarios?: number;
    estadoMensual?: EstadoMensual[];
    acuerdoActivoId?: string;
    historialAcuerdos?: AcuerdoPago[];

    demandados?: DemandadoItem[] | string;
    juzgado?: string;
    numeroRadicado?: string;
    localidad?: string;
    observacionesDemanda?: string;
    observacionesDemandaCliente?: string;


    juzgadoId?: string;
    numeroProceso?: string;
    anoProceso?: number;

    fechaUltimaRevision?: Timestamp | { seconds: number; nanoseconds: number } | Date | FieldValue | null;
}