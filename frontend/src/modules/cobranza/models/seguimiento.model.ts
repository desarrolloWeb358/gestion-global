import { Timestamp } from "firebase/firestore";

export interface Seguimiento {
  id?: string;
  fecha?: Timestamp;
  tipo: 'llamada' | 'correo' | 'whatsapp' | 'sms' | 'visita' | 'otro';
  descripcion: string;
  archivoUrl?: string; // si se carga archivo (PDF, audio, etc.)
}
