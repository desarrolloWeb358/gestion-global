// modules/casos/models/seguimientoCaso.model.ts
//
// Ruta: clientesParticulares/{clienteId}/casos/{casoId}/seguimiento/{id}
//
// A diferencia del seguimiento de demandas, aquí NO existe la distinción
// interno/externo: todo seguimiento registrado lo ve el cliente, y por eso
// cada uno dispara alerta + correo.
import type { FechaFirestore } from "@/modules/cobranza/models/demanda.model";
import type { TipoSeguimientoCode } from "@/shared/constants/tipoSeguimiento";

export interface SeguimientoCaso {
  id?: string;
  fecha: FechaFirestore;
  descripcion: string;
  tipoSeguimiento?: TipoSeguimientoCode;

  archivoPath?: string;
  archivoUrl?: string;
  archivoNombre?: string;

  creadoPor?: string;
  creadoPorNombre?: string;
  actualizadoEn?: FechaFirestore;
}
