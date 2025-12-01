// src/shared/types/notification.types.ts
import type { Timestamp } from "firebase/firestore";

export interface NotificacionAlerta {
  id?: string;
  fecha: Timestamp;       // serverTimestamp() al crear
  descripcion: string;    // texto corto de la alerta
  ruta: string;           // ruta dentro de tu app (/clientes/xxx/...)
  modulo: string;         // "valor_agregado" | "seguimiento" | etc.
  visto: boolean;         // false al crear
}
