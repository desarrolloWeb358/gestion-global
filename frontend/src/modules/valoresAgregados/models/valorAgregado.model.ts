import { Timestamp, FieldValue } from "firebase/firestore";
import { TipoValorAgregado } from "../../../shared/constants/tipoValorAgregado";

export interface ValorAgregado {
  id?: string;

  // Datos principales
  tipo: TipoValorAgregado;
  fecha: Timestamp | { seconds: number; nanoseconds: number } | FieldValue; // día/mes/año
  titulo: string;
  observaciones?: string;          // (corrijo el nombre del campo)
  
  // Archivo en Storage
  archivoPath?: string;            // ruta en Storage (lo que quieres guardar)
  archivoURL?: string;             // opcional: URL de descarga si decides guardarla
  archivoNombre?: string;          // opcional: nombre original del archivo
  
  // Metadatos
  creadoEn?: Timestamp | FieldValue;
  actualizadoEn?: Timestamp | FieldValue;
}
