import { Timestamp } from "firebase/firestore";

export interface ArchivoContrato {
  nombre: string;
  path: string;
  url: string;
}

export interface Contrato {
  id?: string;
  titulo: string;
  descripcion?: string;
  fecha: Timestamp | Date;
  archivos: ArchivoContrato[];
  creadoPor?: string;
  fechaCreacion?: Timestamp;
}
