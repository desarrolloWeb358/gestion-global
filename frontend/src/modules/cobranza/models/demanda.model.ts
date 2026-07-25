// modules/cobranza/models/demanda.model.ts
import { FieldValue, Timestamp } from "firebase/firestore";
import { TipoNotificacionDemanda } from "@/shared/constants/notificacionDemanda";
import { normalizeDemandados } from "./deudores.model";

export type FechaFirestore =
  | Timestamp
  | { seconds: number; nanoseconds: number }
  | Date
  | FieldValue
  | null;

export type EstadoDemanda = "activa" | "terminada";

/** Notificación de un demandado dentro de una demanda. */
export interface NotificacionDemandado {
  tipo: TipoNotificacionDemanda | string;
  fecha: FechaFirestore;
  coteje: boolean;
}

/** Demandado dentro de una demanda: reemplaza al DemandadoItem plano del deudor. */
export interface DemandadoDemanda {
  nombre: string;
  numeroDocumento: string;
  notificaciones: NotificacionDemandado[];
}

/** Etiqueta aplicada a una demanda (referencia al catálogo + detalle/fecha libres). */
export interface EtiquetaEnDemanda {
  etiquetaId?: string;   // referencia a etiquetasDemanda/{id}
  nombre: string;        // denormalizado para mostrar/filtrar sin leer el catálogo
  detalle: string;
  fecha: FechaFirestore; // fecha de posible acción futura
}

/** Datos del monitoreo Rama Judicial (CPNU), antes en el deudor. */
export interface ProcesoJudicialDemanda {
  esPrivado?: boolean | null;
  linkJuzgado?: string;
  estadoSolicitud?: "sinSolicitar" | "solicitado" | "linkRecibido";
  fechaSolicitud?: FechaFirestore;
  fechaUltimaActuacion?: string | null;
  fechaUltimaConsulta?: FechaFirestore;
}

/**
 * Demanda: subcolección clientes/{clienteId}/deudores/{deudorId}/demandas/{demandaId}.
 * Un deudor puede tener varias. El seguimiento vive en la subcolección
 * `seguimientoDemanda` de cada demanda.
 */
export interface Demanda {
  id?: string;

  numeroRadicado?: string;
  juzgado?: string;
  localidad?: string;
  demandaSustituto?: boolean;
  estado: EstadoDemanda;

  demandados: DemandadoDemanda[];
  etiquetas: EtiquetaEnDemanda[];
  // min de etiquetas[].fecha; denormalizado para ordenar por "acción más próxima"
  proximaAccionFecha?: FechaFirestore;

  observacionesDemanda?: string;
  observacionesDemandaCliente?: string;
  observacionesDemandaClienteFecha?: FechaFirestore;

  fechaUltimaRevision?: FechaFirestore;
  fechaCreacion?: FechaFirestore;
  fechaActualizacion?: FechaFirestore;

  procesoJudicial?: ProcesoJudicialDemanda;

  // Denormalizados para el reporte global (collectionGroup("demandas"))
  clienteId?: string;
  deudorId?: string;
  deudorNombre?: string;
  ubicacion?: string;
}

/** Convierte demandados legacy del deudor (string | DemandadoItem[]) a DemandadoDemanda[]. */
export function normalizeDemandadosDemanda(raw: any): DemandadoDemanda[] {
  return normalizeDemandados(raw).map((d) => ({
    nombre: d.nombre,
    numeroDocumento: d.numeroDocumento,
    notificaciones: [],
  }));
}

/** Calcula proximaAccionFecha = mínima fecha (>= hoy) de las etiquetas; null si no hay. */
export function calcularProximaAccion(etiquetas: EtiquetaEnDemanda[]): Date | null {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechas = etiquetas
    .map((e) => toDateSafe(e.fecha))
    .filter((d): d is Date => !!d && d.getTime() >= hoy.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  return fechas[0] ?? null;
}

export function toDateSafe(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
