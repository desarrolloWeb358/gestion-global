// modules/casos/models/caso.model.ts
//
// Caso = expediente de un cliente particular.
// Ruta: clientesParticulares/{clienteParticularId}/casos/{casoId}
//
// Reutiliza a propósito las piezas ya probadas del módulo de demandas:
// el tipo de fecha, las etiquetas (mismo catálogo `configuracion/etiquetasDemanda`)
// y el mapa de monitoreo de la Rama Judicial.
import type {
  EtiquetaEnDemanda,
  FechaFirestore,
  ProcesoJudicialDemanda,
} from "@/modules/cobranza/models/demanda.model";

export type { FechaFirestore };

export type EstadoCaso = "activo" | "terminado";

/** Posición del cliente dentro del proceso. */
export type RolClienteCaso = "demandante" | "demandado" | "otro";

/** La otra parte del proceso (equivalente a `demandados` en una demanda). */
export interface ContraparteCaso {
  nombre: string;
  numeroDocumento: string;
}

/** Misma forma que la etiqueta de una demanda: comparten catálogo. */
export type EtiquetaEnCaso = EtiquetaEnDemanda;

/** Monitoreo CPNU, idéntico al de las demandas. */
export type ProcesoJudicialCaso = ProcesoJudicialDemanda;

/** Documento del caso (poder, demanda, anexos). Lo sube el equipo o el cliente. */
export interface DocumentoCaso {
  id: string;
  nombre: string;
  url: string;
  path: string;
  mime?: string;
  size?: number;
  subidoPor?: string;
  subidoPorNombre?: string;
  /** "cliente" | "equipo" — para mostrar quién aportó el documento */
  subidoPorRol?: "cliente" | "equipo";
  subidoEn?: FechaFirestore;
}

export interface Caso {
  id?: string;

  /** Nombre del tipo, tomado del catálogo `configuracion/tiposCaso`. */
  tipoCaso?: string;
  /** Título corto para identificar el caso en listas. */
  titulo?: string;
  descripcion?: string;

  rolCliente?: RolClienteCaso;
  contraparte: ContraparteCaso[];

  // Datos judiciales: opcionales, hay casos sin radicar o no judiciales.
  numeroRadicado?: string;
  juzgado?: string;
  localidad?: string;

  estado: EstadoCaso;

  etiquetas: EtiquetaEnCaso[];
  /** min de etiquetas[].fecha (>= hoy); denormalizado para ordenar por acción más próxima */
  proximaAccionFecha?: FechaFirestore;

  documentos: DocumentoCaso[];

  procesoJudicial?: ProcesoJudicialCaso;

  fechaInicio?: FechaFirestore;
  fechaUltimaRevision?: FechaFirestore;
  fechaCreacion?: FechaFirestore;
  fechaActualizacion?: FechaFirestore;

  // Denormalizados para el reporte global — collectionGroup("casos")
  clienteParticularId?: string;
  clienteNombre?: string;
}

export const ROL_CLIENTE_LABEL: Record<RolClienteCaso, string> = {
  demandante: "Demandante",
  demandado: "Demandado",
  otro: "Otro",
};

export const ESTADO_CASO_LABEL: Record<EstadoCaso, string> = {
  activo: "Activo",
  terminado: "Terminado",
};
