import { Timestamp } from "firebase/firestore";
import { TipoSeguimientoCode } from "../../../shared/constants/tipoSeguimiento";


export interface Seguimiento {
  id?: string;
  fecha?: Timestamp | Date;
  tipoSeguimiento?: TipoSeguimientoCode;
  descripcion: string;
  archivoUrl?: string;
  actualizadoEn?: Timestamp;
}
