import { Timestamp } from "firebase/firestore";
import { TipoSeguimientoCode } from "../../../shared/constants/tipoSeguimiento";


export interface Seguimiento {
  id?: string;
  fecha?: Timestamp;
  tipoSeguimiento?: TipoSeguimientoCode;
  descripcion: string;
  archivoUrl?: string; // si se carga archivo (PDF, audio, etc.)
}
