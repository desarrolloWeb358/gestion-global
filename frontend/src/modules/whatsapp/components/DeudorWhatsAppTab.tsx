import { useEffect, useRef, useState } from "react";
import { MessageCircle, RefreshCw } from "lucide-react";
import { IconChevronUp } from "@tabler/icons-react";
import { ChatBubble } from "./ChatBubble";
import { Button } from "@/shared/ui/button";
import { Typography } from "@/shared/design-system/components/Typography";
import { getConversationsByDeudorId } from "../services/conversationsService";
import { listenLatestMessages, fetchMessagesPage } from "../services/messagesService";
import type { WaConversation } from "../models/waConversation.model";
import type { WaMessage } from "../models/waMessage.model";
import type { QueryDocumentSnapshot } from "firebase/firestore";

interface Props {
  deudorId: string;
  clienteId: string;
  deudorNombre: string;
}

function MiniChat({ numberId, convId }: { numberId: string; convId: string }) {
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const mapRef = useRef(new Map<string, WaMessage>());
  const cursorRef = useRef<QueryDocumentSnapshot | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef("");

  function rebuild() {
    const sorted = [...mapRef.current.values()].sort((a, b) => a.timestampMs - b.timestampMs);
    setMessages(sorted);
  }

  useEffect(() => {
    mapRef.current.clear();
    cursorRef.current = null;
    setMessages([]);
    setHasMore(false);

    fetchMessagesPage(numberId, convId, 30).then(({ messages: initial, lastDoc }) => {
      cursorRef.current = lastDoc;
      setHasMore(initial.length === 30);
      initial.forEach((m) => mapRef.current.set(m.id, m));
      rebuild();
    });

    return listenLatestMessages(numberId, convId, (latest) => {
      latest.forEach((m) => mapRef.current.set(m.id, m));
      rebuild();
    });
  }, [numberId, convId]);

  const lastMsgId = messages.at(-1)?.id ?? "";
  useEffect(() => {
    if (lastMsgId && lastMsgId !== lastIdRef.current) {
      lastIdRef.current = lastMsgId;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [lastMsgId]);

  async function loadMore() {
    if (!cursorRef.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const { messages: older, lastDoc } = await fetchMessagesPage(numberId, convId, 30, cursorRef.current);
      cursorRef.current = lastDoc;
      setHasMore(older.length === 30);
      older.forEach((m) => mapRef.current.set(m.id, m));
      rebuild();
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {hasMore && (
          <div className="flex justify-center pb-2">
            <Button variant="ghost" size="sm" onClick={loadMore} disabled={loadingMore} className="text-xs gap-1 text-muted-foreground">
              <IconChevronUp className="w-3 h-3" />
              {loadingMore ? "Cargando..." : "Cargar anteriores"}
            </Button>
          </div>
        )}
        {messages.length === 0 && (
          <div className="flex items-center justify-center py-10">
            <p className="text-xs text-muted-foreground">Sin mensajes aún</p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export function DeudorWhatsAppTab({ deudorId }: Props) {
  const [conversations, setConversations] = useState<WaConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);

  function load() {
    setLoading(true);
    getConversationsByDeudorId(deudorId)
      .then((convs) => {
        setConversations(convs);
        setSelectedIdx(0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [deudorId]);

  const selected = conversations[selectedIdx] ?? null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
        <Typography variant="small" className="text-gray-500">Buscando conversaciones...</Typography>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm p-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="p-4 rounded-full bg-brand-primary/10">
            <MessageCircle className="h-8 w-8 text-brand-primary/50" />
          </div>
          <Typography variant="h3" className="text-brand-secondary">Sin conversaciones de WhatsApp</Typography>
          <Typography variant="small" className="text-gray-500">
            No se encontraron conversaciones vinculadas a este deudor.
          </Typography>
          <Button variant="ghost" size="sm" onClick={load} className="gap-1.5 mt-1 text-brand-primary">
            <RefreshCw className="h-3.5 w-3.5" />
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
      {/* Header con selector de número si hay más de uno */}
      <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 px-4 py-3 border-b border-brand-secondary/10 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-brand-primary" />
          <Typography variant="h3" className="!text-brand-secondary text-sm font-semibold">
            Conversación de WhatsApp
          </Typography>
        </div>

        {conversations.length > 1 && (
          <div className="flex items-center gap-1 flex-wrap">
            {conversations.map((c, i) => (
              <button
                key={c.id}
                onClick={() => setSelectedIdx(i)}
                className={`px-3 py-1 rounded-full text-xs font-mono font-medium border transition-colors ${
                  i === selectedIdx
                    ? "bg-brand-primary text-white border-brand-primary"
                    : "bg-white text-gray-600 border-brand-secondary/30 hover:border-brand-primary hover:text-brand-primary"
                }`}
              >
                +{c.userAddress}
              </button>
            ))}
          </div>
        )}

        {conversations.length === 1 && (
          <span className="text-xs font-mono text-gray-500">+{selected?.userAddress}</span>
        )}

        <Button variant="ghost" size="sm" onClick={load} className="gap-1 text-gray-400 hover:text-brand-primary h-7 px-2">
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      {/* Área de mensajes */}
      {selected && (
        <div className="h-[500px]">
          <MiniChat numberId={selected.numberId} convId={selected.id} />
        </div>
      )}
    </div>
  );
}
