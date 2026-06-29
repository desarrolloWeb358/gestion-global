// models/franquicia.model.ts
import { Timestamp, FieldValue } from "firebase/firestore";

export interface Franquicia {
  id?: string; // = id del documento (autogenerado por Firestore, opaco y estable)

  nombre: string; // "Bogotá", "Eje Cafetero" — editable, es lo único que ve el usuario
  ciudades: string[]; // ["Pereira", "Armenia", "Manizales"] — la franquicia no se ata a una sola ciudad

  activo?: boolean;
  fechaCreacion?: Timestamp | { seconds: number; nanoseconds: number } | FieldValue;
}
