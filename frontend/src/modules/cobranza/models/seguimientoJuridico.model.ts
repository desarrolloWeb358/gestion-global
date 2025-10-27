import { Timestamp } from "firebase/firestore";
import { TipoSeguimientoCode } from "../../../shared/constants/tipoSeguimiento";

// Igual forma para reusar UI. Si más adelante necesitas campos extra (p.ej. etapa),
// los agregas aquí sin romper el pre-jurídico.
export interface SeguimientoJuridico {
  id?: string;
  fecha?: Timestamp;
  tipoSeguimiento?: TipoSeguimientoCode;
  descripcion: string;
  archivoUrl?: string;
}
