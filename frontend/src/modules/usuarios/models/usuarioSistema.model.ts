import { Timestamp, FieldValue } from "firebase/firestore";
import type { Rol } from "@/shared/constants/acl";

export interface UsuarioSistema {
  uid: string;
  email: string;
  nombre?: string;
  telefonoUsuario?: string;
  roles: Rol[];  // ← usa el tipo centralizado
  tipoDocumento: "CC" | "CE" | "TI" | "NIT";
  numeroDocumento: string;
  fecha_registro?: Timestamp | { seconds: number; nanoseconds: number } | FieldValue;
  activo?: boolean;
  clienteIdAsociado?: string; // ID del cliente al que pertenece este deudor
  deudorIdAsociado?: string;  // ID del deudor dentro de clientes/{clienteId}/deudores
}
