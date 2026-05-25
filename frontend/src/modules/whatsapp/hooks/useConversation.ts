import { useEffect, useState } from "react";
import { listenConversation } from "../services/conversationsService";
import type { WaConversation } from "../models/waConversation.model";

/**
 * undefined = aún cargando (primer snapshot no ha llegado)
 * null      = conversación no existe en Firestore
 * WaConversation = cargada correctamente
 */
export function useConversation(numberId: string, convId: string) {
  const [conversation, setConversation] = useState<WaConversation | null | undefined>(undefined);

  useEffect(() => {
    if (!numberId || !convId) return;
    setConversation(undefined); // resetear al cambiar de conversación
    return listenConversation(numberId, convId, setConversation);
  }, [numberId, convId]);

  return conversation;
}
