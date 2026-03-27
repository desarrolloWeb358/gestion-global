import { Timestamp } from "firebase/firestore"

export interface ArchivoObservacion {
  nombre: string
  path: string
  url: string
}

export interface ObservacionClienteGlobal {
  id?: string
  texto: string
  fecha?: Timestamp
  // Campos planos legado (se mantienen para compatibilidad con docs existentes)
  archivoUrl?: string
  archivoNombre?: string
  // Múltiples archivos (campo nuevo)
  archivos?: ArchivoObservacion[]
  usuarioId?: string
  rol?: "cliente" | "ejecutivo"
}