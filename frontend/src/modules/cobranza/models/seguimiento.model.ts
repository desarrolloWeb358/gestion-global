import { Timestamp } from "firebase/firestore";

export type TipoSeguimiento = 'llamada' | 'correo' | 'whatsapp' | 'sms' | 'visita' | 'otro';
export interface Seguimiento {
  id?: string;
  fecha?: Timestamp;
  tipoSeguimiento?: TipoSeguimiento;
  tipo: number;
  descripcion: string;
  archivoUrl?: string; // si se carga archivo (PDF, audio, etc.)
}
