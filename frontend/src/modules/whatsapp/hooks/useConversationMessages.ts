import { useEffect, useRef, useState } from "react";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { listenLatestMessages, fetchMessagesPage } from "../services/messagesService";
import type { WaMessage } from "../models/waMessage.model";

export function useConversationMessages(numberId: string, convId: string) {
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Mapa dedupeado por ID de mensaje
  const mapRef    = useRef(new Map<string, WaMessage>());
  const cursorRef = useRef<QueryDocumentSnapshot | null>(null);

  function rebuild() {
    const sorted = [...mapRef.current.values()].sort(
      (a, b) => a.timestampMs - b.timestampMs
    );
    setMessages(sorted);
  }

  useEffect(() => {
    if (!numberId || !convId) return;

    // Limpiar estado al cambiar de conversación
    mapRef.current.clear();
    cursorRef.current = null;
    setMessages([]);
    setHasMore(false);

    // 1. Carga histórica inicial (página más reciente)
    fetchMessagesPage(numberId, convId, 30).then(({ messages: initial, lastDoc }) => {
      cursorRef.current = lastDoc;
      setHasMore(initial.length === 30);
      initial.forEach((m) => mapRef.current.set(m.id, m));
      rebuild();
    });

    // 2. Listener tiempo real de los últimos 30 — fusiona con el mapa
    const unsub = listenLatestMessages(numberId, convId, (latest) => {
      latest.forEach((m) => mapRef.current.set(m.id, m));
      rebuild();
    });

    return unsub;
  }, [numberId, convId]);

  // Carga mensajes más antiguos (paginación hacia atrás)
  async function loadMore() {
    if (!cursorRef.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const { messages: older, lastDoc } = await fetchMessagesPage(
        numberId,
        convId,
        30,
        cursorRef.current
      );
      cursorRef.current = lastDoc;
      setHasMore(older.length === 30);
      older.forEach((m) => mapRef.current.set(m.id, m));
      rebuild();
    } finally {
      setLoadingMore(false);
    }
  }

  return { messages, hasMore, loadingMore, loadMore };
}
