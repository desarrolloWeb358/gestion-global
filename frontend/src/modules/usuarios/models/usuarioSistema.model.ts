import { Timestamp, FieldValue } from "firebase/firestore";
import type { Rol } from "@/shared/constants/acl";

export interface UsuarioSistema {
  uid: string;
  email: string;
  nombre: string; // requerido
  telefonoUsuario?: string;
  roles: Rol[];  // ← usa el tipo centralizado
  tipoDocumento: "CC" | "CE" | "TI" | "NIT";
  numeroDocumento: string;
  fecha_registro?: Timestamp | { seconds: number; nanoseconds: number } | FieldValue;
  activo?: boolean;
}
