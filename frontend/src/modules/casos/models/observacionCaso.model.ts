// modules/casos/models/observacionCaso.model.ts
//
// Hilo de conversación del caso: clientesParticulares/{clienteId}/casos/{casoId}/observaciones/{id}
// Lo escriben tanto el cliente como el equipo (abogado / dependiente).
import type { FechaFirestore } from "@/modules/cobranza/models/demanda.model";

export type AutorObservacion = "cliente" | "equipo";

export interface ObservacionCaso {
  id?: string;
  texto: string;
  fecha?: FechaFirestore;

  autorUid: string;
  autorNombre: string;
  autorRol: AutorObservacion;

  archivoUrl?: string;
  archivoPath?: string;
  archivoNombre?: string;
}
