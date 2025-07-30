import { Timestamp, FieldValue } from "firebase/firestore";

export interface UsuarioSistema {
  uid: string;
  email: string;
  nombre: string; // requerido
  telefonoUsuario?: string;
  roles: ("admin" | "ejecutivo" | "abogado" | "cliente" | "deudor")[];
  tipoDocumento: 'CC' | 'CE' | 'TI' | 'NIT'; // requerido
  numeroDocumento: string; // requerido
  fecha_registro?: Timestamp | { seconds: number; nanoseconds: number } | FieldValue;
  activo?: boolean;
}
