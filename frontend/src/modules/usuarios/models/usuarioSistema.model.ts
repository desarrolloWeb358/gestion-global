import { Timestamp, FieldValue } from "firebase/firestore";

export interface UsuarioSistema {
    uid: string;
    email: string;
    telefono?: string;
    rol: 'admin' | 'ejecutivo' | 'cliente' | 'inmueble';
    nombre?: string;
    fecha_registro?: Timestamp | { seconds: number; nanoseconds: number } | FieldValue;
    activo?: boolean;
  }