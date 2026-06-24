import { useEffect, useState } from "react";
import { listenInbox, searchConversationsByEjecutivoId } from "../services/conversationsService";
import type { WaConversation } from "../models/waConversation.model";
import type { Rol } from "@/shared/constants/acl";

export function useInboxConversations(numberId: string, uid: string, roles: Rol[]) {
  const [conversations, setConversations] = useState<WaConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!numberId || !uid) return;
    setLoading(true);

    const isSuperAdmin =
      roles.includes("admin") ||
      roles.includes("supervisor") ||
      roles.includes("ejecutivoAdmin");

    if (isSuperAdmin) {
      const unsub = listenInbox(numberId, (convs) => {
        setConversations(convs);
        setLoading(false);
      });
      return unsub;
    }

    // Para ejecutivos normales, usar searchConversationsByEjecutivoId sin limite de 50
    let cancelled = false;
    searchConversationsByEjecutivoId(numberId, uid).then((convs) => {
      if (!cancelled) {
        setConversations(convs);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberId, uid, roles.join(",")]);

  return { conversations, loading };
}
