import { Timestamp } from "firebase/firestore";
import { TipoSeguimiento } from "./seguimiento.model";

// Igual forma para reusar UI. Si más adelante necesitas campos extra (p.ej. etapa),
// los agregas aquí sin romper el pre-jurídico.
export interface SeguimientoJuridico {
  id?: string;
  fecha?: Timestamp;
  tipoSeguimiento?: TipoSeguimiento;
  descripcion: string;
  archivoUrl?: string;
}
