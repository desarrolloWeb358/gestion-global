import { Timestamp } from "firebase/firestore";

export enum TipoSeguimiento {
  LLAMADA = "LLAMADA",
  VISITA = "VISITA",
  CORREO = "CORREO",
  WHATSAPP = "WHATSAPP",
  NOTIFICACION = "NOTIFICACION",
  OTRO = "OTRO",
}
export interface Seguimiento {
  id?: string;
  fecha?: Timestamp;
  tipoSeguimiento?: TipoSeguimiento;
  descripcion: string;
  archivoUrl?: string; // si se carga archivo (PDF, audio, etc.)
}
