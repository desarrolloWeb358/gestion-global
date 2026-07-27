import { useEffect, useRef, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconArrowLeft,
  IconChevronUp,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightExpand,
  IconMailOff,
} from "@tabler/icons-react";
import { useConversationMessages } from "../hooks/useConversationMessages";
import { useConversation } from "../hooks/useConversation";
import {
  markConversationRead,
  markConversationUnread,
  isMetaWindowOpen,
} from "../services/conversationsService";
import { ChatBubble } from "./ChatBubble";
import { HumanReplyBox } from "./HumanReplyBox";
import { Button } from "@/shared/ui/button";

function getDateLabel(timestampMs: number): string {
  const date = new Date(timestampMs);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";
  // es-CO devuelve el día en minúscula ("mar, 30 de jun")
  const etiqueta = date.toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);
}

function sameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

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

  // Marcar como leída al abrir y también cuando llega un mensaje nuevo con el
  // hilo ya abierto. Si la pestaña está oculta se deja sin leer y se marca al
  // volver (efecto de abajo).
  const unread = conversation?.unreadCount ?? 0;
  const unreadRef = useRef(0);

  // Si el usuario la marcó como no leída a mano, el automatismo de abajo no
  // debe deshacerlo. El componente lleva key={convId}, así que esta bandera se
  // reinicia sola al abrir otra conversación.
  const marcadaNoLeidaRef = useRef(false);

  useEffect(() => {
    unreadRef.current = unread;
    if (marcadaNoLeidaRef.current) return;
    if (unread > 0 && !document.hidden) {
      markConversationRead(numberId, convId).catch(() => {});
    }
  }, [numberId, convId, unread]);

  useEffect(() => {
    const onVisibility = () => {
      if (marcadaNoLeidaRef.current) return;
      if (!document.hidden && unreadRef.current > 0) {
        markConversationRead(numberId, convId).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [numberId, convId]);

  // Dejarla pendiente y salir a la bandeja: quedarse dentro de una
  // conversación "no leída" no tiene sentido y además el automatismo de
  // arriba la volvería a marcar en cuanto llegara cualquier actualización.
  const handleMarcarNoLeida = async () => {
    marcadaNoLeidaRef.current = true;
    try {
      await markConversationUnread(numberId, convId);
    } finally {
      navigate(`/whatsapp/${numberId}`);
    }
  };

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

        {/* Dejar pendiente: vuelve a la bandeja con la conversación sin leer */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleMarcarNoLeida}
          title="Marcar como no leída y volver a la bandeja"
          className="gap-1.5 text-xs h-8 flex-shrink-0"
        >
          <IconMailOff className="w-4 h-4" />
          <span className="hidden sm:inline">No leída</span>
        </Button>

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

        {messages.map((msg, i) => (
          <Fragment key={msg.id}>
            {(i === 0 || !sameDay(messages[i - 1].timestampMs, msg.timestampMs)) && (
              <div className="flex items-center justify-center my-4 select-none">
                <span className="text-xs font-semibold text-foreground/80 bg-muted border border-border rounded-full px-3 py-1 shadow-sm">
                  {getDateLabel(msg.timestampMs)}
                </span>
              </div>
            )}
            <ChatBubble message={msg} />
          </Fragment>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Caja de respuesta */}
      <HumanReplyBox numberId={numberId} convId={convId} windowOpen={windowOpen} />
    </div>
  );
}
