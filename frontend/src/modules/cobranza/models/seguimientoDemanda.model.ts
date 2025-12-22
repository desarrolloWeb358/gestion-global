export interface SeguimientoDemanda {
  id?: string;
  consecutivo: string;            // puede ser número, pero guardado como string para evitar problemas
  fecha: any;                     // Firestore Timestamp | Date | string
  descripcion: string;
  esInterno?: boolean;
  archivoUrl?: string | null;
}