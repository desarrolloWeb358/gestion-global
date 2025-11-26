import { Timestamp, FieldValue } from "firebase/firestore";

export type AutorTipoValorAgregado = "cliente" | "abogado";

export interface MensajeValorAgregado {
  id?: string;

  descripcion: string;
  fecha: Timestamp | { seconds: number; nanoseconds: number } | FieldValue;

  // Archivo asociado al mensaje (opcional)
  archivoPath?: string;
  archivoURL?: string;
  archivoNombre?: string;

  // Sólo necesitamos saber si lo escribió el cliente o el abogado
  autorTipo: AutorTipoValorAgregado; // "cliente" | "abogado"
}
