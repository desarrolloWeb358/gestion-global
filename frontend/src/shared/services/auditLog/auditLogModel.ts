import type { Timestamp } from "firebase/firestore";

export type ModuloApp =
  | "valorAgregado"
  | "mensajeConversacion"
  | "seguimientoPreJuridico"
  | "seguimientoJuridico"
  | "seguimientoDemanda"
  | "observacionCliente"
  | "historialTipificacion"
  | "estadoMensual"
  | "cliente"
  | "usuario"
  | "deudor";

export interface RegistroEliminado {
  id?: string;
  uid: string;              // UID del usuario que ejecutó la eliminación
  modulo: ModuloApp;        // Módulo de la aplicación donde ocurrió
  descripcion: string;      // Descripción legible de lo eliminado
  coleccionPath: string;    // Path completo de la colección en Firestore
  fechaEliminacion: Timestamp;
}