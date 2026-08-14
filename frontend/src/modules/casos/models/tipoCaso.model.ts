// modules/casos/models/tipoCaso.model.ts
//
// Catálogo interno de tipos de caso (ejecutivo, verbal, tutela, sucesión,
// derecho de petición, asesoría...). Igual que las etiquetas de demanda, vive
// como DOCUMENTO de la colección `configuracion`, no como colección raíz.
import type { FieldValue, Timestamp } from "firebase/firestore";

export interface TipoCaso {
  id?: string;
  nombre: string;
  activo: boolean;
  fechaCreacion?: Timestamp | { seconds: number; nanoseconds: number } | FieldValue;
}
