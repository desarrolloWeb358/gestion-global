import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconArrowLeft,
  IconChevronUp,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightExpand,
} from "@tabler/icons-react";
import { useConversationMessages } from "../hooks/useConversationMessages";
import { useConversation } from "../hooks/useConversation";
import { markConversationRead, isMetaWindowOpen } from "../services/conversationsService";
import { ChatBubble } from "./ChatBubble";
import { HumanReplyBox } from "./HumanReplyBox";
import { Button } from "@/shared/ui/button";

interface Props {
  numberId: string;
  convId: string;
  showInbox: boolean;
  showDetails: boolean;
  onToggleInbox: () => void;
  onToggleDetails: () => void;
  isMobile?: boolean;
}

export function ConversationThread({
  numberId,
  convId,
  showInbox,
  showDetails,
  onToggleInbox,
  onToggleDetails,
  isMobile = false,
}: Props) {
  const navigate = useNavigate();
  const { messages, hasMore, loadingMore, loadMore } = useConversationMessages(
    numberId,
    convId
  );
  const conversation = useConversation(numberId, convId);
  const windowOpen = isMetaWindowOpen(conversation?.lastInboundAt);

  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string>("");

  // Marcar como leída al abrir
  useEffect(() => {
    markConversationRead(numberId, convId).catch(() => {});
  }, [numberId, convId]);

  // Auto-scroll solo cuando llega un mensaje nuevo
  const lastMsgId = messages.at(-1)?.id ?? "";
  useEffect(() => {
    if (lastMsgId && lastMsgId !== lastIdRef.current) {
      lastIdRef.current = lastMsgId;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [lastMsgId]);

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-border flex items-center gap-2">
        {/* Botón izquierdo: volver (mobile) o toggle bandeja (desktop) */}
        {isMobile ? (
          <button
            onClick={() => navigate(`/whatsapp/${numberId}`)}
            className="p-1.5 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground flex-shrink-0"
            title="Volver al inbox"
          >
            <IconArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleInbox}
            className="gap-1.5 text-xs h-8 flex-shrink-0"
            title={showInbox ? "Ocultar bandeja" : "Mostrar bandeja"}
          >
            {showInbox
              ? <IconLayoutSidebarLeftCollapse className="w-4 h-4" />
              : <IconLayoutSidebarLeftExpand className="w-4 h-4" />}
            Bandeja
          </Button>
        )}

        {/* Info contacto */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {conversation?.deudorNombre ?? `+${convId}`}
          </p>
          {conversation?.deudorNombre && (
            <p className="text-[11px] text-muted-foreground font-mono">+{convId}</p>
          )}
        </div>

        {/* Botón detalles: siempre visible en mobile, solo lg en desktop */}
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleDetails}
          className={`gap-1.5 text-xs h-8 flex-shrink-0 ${isMobile ? "flex" : "hidden lg:flex"}`}
          title={isMobile ? "Ver detalles" : (showDetails ? "Ocultar detalles" : "Mostrar detalles")}
        >
          {!isMobile && showDetails
            ? <IconLayoutSidebarRightCollapse className="w-4 h-4" />
            : <IconLayoutSidebarRightExpand className="w-4 h-4" />}
          Detalles
        </Button>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {hasMore && (
          <div className="flex justify-center pb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadMore}
              disabled={loadingMore}
              className="text-xs gap-1 text-muted-foreground"
            >
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

      {/* Caja de respuesta */}
      <HumanReplyBox numberId={numberId} convId={convId} windowOpen={windowOpen} />
    </div>
  );
}
