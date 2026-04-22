import { useEffect, useState } from "react";
import { listenConversation } from "../services/conversationsService";
import type { WaConversation } from "../models/waConversation.model";

export function useConversation(numberId: string, convId: string) {
  const [conversation, setConversation] = useState<WaConversation | null>(null);

  useEffect(() => {
    if (!numberId || !convId) return;
    return listenConversation(numberId, convId, setConversation);
  }, [numberId, convId]);

  return conversation;
}
