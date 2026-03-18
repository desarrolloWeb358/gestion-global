import { Timestamp, FieldValue } from "firebase/firestore";
import { ArchivoAdjunto } from "./valorAgregado.model";

export type AutorTipoValorAgregado = "cliente" | "abogado";

export interface MensajeValorAgregado {
  id?: string;

  descripcion: string;
  fecha: Timestamp | { seconds: number; nanoseconds: number } | FieldValue;

  // Archivo legado (campo plano, se mantiene para compatibilidad con docs existentes)
  archivoPath?: string;
  archivoURL?: string;
  archivoNombre?: string;

  // Múltiples archivos (campo nuevo)
  archivos?: ArchivoAdjunto[];

  // Sólo necesitamos saber si lo escribió el cliente o el abogado
  autorTipo: AutorTipoValorAgregado; // "cliente" | "abogado"
}
