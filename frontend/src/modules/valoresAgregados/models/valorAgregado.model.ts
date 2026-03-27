import { Timestamp, FieldValue } from "firebase/firestore";
import { TipoValorAgregado } from "../../../shared/constants/tipoValorAgregado";

export interface ArchivoAdjunto {
  nombre: string;
  path: string;
  url: string;
}

export interface ValorAgregado {
  id?: string;

  // Datos principales
  tipo: TipoValorAgregado;
  fecha: Timestamp | { seconds: number; nanoseconds: number } | FieldValue; // día/mes/año
  titulo: string;
  descripcion?: string;

  // Archivo legado (campo plano, se mantiene para compatibilidad con docs existentes)
  archivoPath?: string;
  archivoURL?: string;
  archivoNombre?: string;

  // Múltiples archivos (campo nuevo)
  archivos?: ArchivoAdjunto[];

  // Completado
  completado?: boolean;
  fechaCompletado?: Timestamp | null;
  fechaLimite?: Timestamp | null;
}
