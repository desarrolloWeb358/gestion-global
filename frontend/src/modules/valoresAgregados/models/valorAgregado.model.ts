import { Timestamp, FieldValue } from "firebase/firestore";
import { TipoValorAgregado } from "../../../shared/constants/tipoValorAgregado";

export interface ArchivoAdjunto {
  nombre: string;
  path: string;
  url: string;
}

/** Estado real del trámite. Lo mueve una persona (botón Resolver/Reabrir) o la
 *  reapertura automática cuando el cliente escribe sobre un VA ya resuelto.
 *  NO lo mueve el ir y venir de la conversación: para eso está `esperaRespuestaDe`. */
export type EstadoValorAgregado = "abierto" | "resuelto";

/** De quién es el turno. Lo escribe la Cloud Function de conversación en cada
 *  mensaje. Es independiente de `estado`: un VA puede estar abierto esperando al
 *  cliente, y eso ya no es deuda del área jurídica. */
export type EsperaRespuestaDe = "juridica" | "cliente";

export interface ValorAgregado {
  id?: string;

  // Datos principales
  tipo: TipoValorAgregado;
  fecha: Timestamp | { seconds: number; nanoseconds: number } | FieldValue; // día/mes/año
  titulo: string;
  descripcion?: string;

  /** Denormalizado desde el documento padre. Sin esto la pantalla global no puede
   *  acotar la consulta por abogado (mismo patrón que `demandas.clienteId`). */
  clienteId?: string;

  // Archivo legado (campo plano, se mantiene para compatibilidad con docs existentes)
  archivoPath?: string;
  archivoURL?: string;
  archivoNombre?: string;

  // Múltiples archivos (campo nuevo)
  archivos?: ArchivoAdjunto[];

  // ===== Estado del trámite =====
  estado?: EstadoValorAgregado;
  /** Fecha de la última resolución. Es la "fecha de entrega" del reporte mensual.
   *  `null` ⇒ nunca se ha resuelto, y solo entonces aplican los recordatorios de
   *  plazo legal. Reabrir NO la limpia. */
  fechaResolucion?: Timestamp | { seconds: number; nanoseconds: number } | null;
  /** uid de quien marcó Resuelto por última vez. */
  resueltoPor?: string | null;
  /** La migración no pudo determinar el estado con certeza; queda para revisión
   *  manual desde la pantalla global. Se borra al resolver o reabrir a mano. */
  estadoMigradoRevisar?: boolean;

  // ===== Turno de la conversación =====
  esperaRespuestaDe?: EsperaRespuestaDe;

  /** Plazo legal. Se calcula UNA sola vez al radicar y nunca se recalcula:
   *  reabrir un trámite no hace que el plazo vuelva a correr. */
  fechaLimite?: Timestamp | null;

  // Última actualización (fecha del mensaje más reciente en la conversación)
  fechaUltimaActualizacion?: Timestamp | { seconds: number; nanoseconds: number } | null;

  /** @deprecated Sustituido por `estado`. Se sigue escribiendo durante la
   *  transición (fases 0-4) y se elimina en la fase 5. */
  completado?: boolean;
  /** @deprecated Sustituido por `fechaResolucion`. */
  fechaCompletado?: Timestamp | null;
}
