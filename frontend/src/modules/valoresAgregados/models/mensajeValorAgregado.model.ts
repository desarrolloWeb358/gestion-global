import { Timestamp, FieldValue } from "firebase/firestore";
import { ArchivoAdjunto } from "./valorAgregado.model";

export type AutorTipoValorAgregado =
  | "cliente"
  | "abogado"
  | "dependiente"
  | "admin"
  | "ejecutivoAdmin"
  | "ejecutivo"
  | "supervisor"
  | "adminFranquicia";

export interface MensajeValorAgregado {
  id?: string;

  descripcion: string;
  fecha: Timestamp | { seconds: number; nanoseconds: number } | FieldValue;
  fechaEdicion?: Timestamp | { seconds: number; nanoseconds: number } | FieldValue;

  // Archivo legado (campo plano, se mantiene para compatibilidad con docs existentes)
  archivoPath?: string;
  archivoURL?: string;
  archivoNombre?: string;

  // Múltiples archivos (campo nuevo)
  archivos?: ArchivoAdjunto[];

  autorTipo: AutorTipoValorAgregado;
}
