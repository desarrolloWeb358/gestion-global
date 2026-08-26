import type { Timestamp } from "firebase/firestore";

/** Una notificación significa una sola cosa: "pasó algo, ve a verlo".
 *  `visto` es lo único que la apaga. No lleva estado de negocio: si quieres saber
 *  si un trámite sigue abierto, eso vive en el documento del trámite. */
export interface NotificacionAlerta {
  id?: string;
  fecha: Timestamp;       // serverTimestamp() al crear
  descripcion: string;    // texto corto de la alerta
  ruta: string;           // ruta dentro de tu app (/clientes/xxx/...)
  modulo: string;         // "valor agregado" | "seguimiento" | etc.
  visto: boolean;         // false al crear
}
