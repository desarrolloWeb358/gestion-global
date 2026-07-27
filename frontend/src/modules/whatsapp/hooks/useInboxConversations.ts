import { useEffect, useState } from "react";
import {
  listenInbox,
  listenInboxByEjecutivo,
  listenUnassignedInbox,
} from "../services/conversationsService";
import type { WaConversation } from "../models/waConversation.model";

/**
 * mine       → conversaciones de los conjuntos a cargo del usuario
 * all        → todas las del número (solo acceso total)
 * unassigned → las que no están vinculadas a ningún conjunto
 * null       → aún no se sabe el alcance (no se suscribe nada)
 */
export type InboxScope = "mine" | "all" | "unassigned";

export function useInboxConversations(
  numberId: string,
  uid: string,
  scope: InboxScope | null
) {
  const [conversations, setConversations] = useState<WaConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!numberId || !uid || !scope) return;
    setLoading(true);

    const handle = (convs: WaConversation[]) => {
      setConversations(convs);
      setLoading(false);
    };

    // Los tres caminos son listeners en vivo.
    if (scope === "all") return listenInbox(numberId, handle);
    if (scope === "unassigned") return listenUnassignedInbox(numberId, handle);
    return listenInboxByEjecutivo(numberId, uid, handle);
  }, [numberId, uid, scope]);

  return { conversations, loading };
}
