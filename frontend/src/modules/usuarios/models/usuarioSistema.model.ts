import { Timestamp, FieldValue } from "firebase/firestore";

export interface UsuarioSistema {
    uid: string;
    email: string;
    telefonoUsuario?: string;
    roles: ("admin" | "ejecutivo" | "abogado" | "cliente" | "deudor")[];
    nombre?: string;
    fecha_registro?: Timestamp | { seconds: number; nanoseconds: number } | FieldValue;
    activo?: boolean;
    tipoDocumento?: 'CC' | 'CE' | 'TI' | 'NIT';
    numeroDocumento?: string;
  }