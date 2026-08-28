import type { Evento } from "../models/evento.model";

/**
 * Quién puede tocar un evento: únicamente quien lo creó.
 *
 * Antes bastaba con el permiso `eventos.manage` —que tienen admin, supervisor y
 * ejecutivoAdmin— para editar, mover o borrar la agenda de cualquiera. Es
 * demasiada gente para una agenda compartida: un evento es de quien lo agendó.
 *
 * Se compara contra `creadoPor` y también contra `organizadorId` porque los
 * eventos creados antes de que existiera la trazabilidad pueden traer el primero
 * vacío. Los asistentes NO son dueños del evento: ellos solo pueden avisar que
 * no asistirán.
 */
export function esDuenoEvento(evento: Pick<Evento, "creadoPor" | "organizadorId">, uid?: string): boolean {
  if (!uid) return false;
  return evento.creadoPor === uid || evento.organizadorId === uid;
}

/** Mensaje único para cuando alguien intenta modificar un evento ajeno. */
export const MENSAJE_NO_ES_DUENO =
  "Solo quien creó el evento puede editarlo, moverlo o eliminarlo.";
