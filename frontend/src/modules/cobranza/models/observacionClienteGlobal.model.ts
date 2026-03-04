import { Timestamp } from "firebase/firestore"

export interface ObservacionClienteGlobal {
  id?: string
  texto: string
  fecha?: Timestamp
  archivoUrl?: string
  archivoNombre?: string
  usuarioId?: string
  rol?: "cliente" | "ejecutivo"
}