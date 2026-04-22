import { useEffect, useState } from "react";
import { listenInbox } from "../services/conversationsService";
import type { WaConversation } from "../models/waConversation.model";

export function useInboxConversations(numberId: string) {
  const [conversations, setConversations] = useState<WaConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!numberId) return;
    setLoading(true);
    const unsub = listenInbox(numberId, (convs) => {
      setConversations(convs);
      setLoading(false);
    });
    return unsub;
  }, [numberId]);

  return { conversations, loading };
}
