import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconMessage, IconTemplate, IconEdit } from "@tabler/icons-react";
import { useInboxConversations } from "../hooks/useInboxConversations";
import { isMetaWindowOpen } from "../services/conversationsService";
import { NewMessageDialog } from "./NewMessageDialog";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";

interface Props {
  numberId: string;
  activeConvId?: string;
}

function formatTime(ts: { toDate?: () => Date } | undefined): string {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) {
    return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true });
  }
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}


export function InboxPanel({ numberId, activeConvId }: Props) {
  const { usuario, roles } = useUsuarioActual();
  const { conversations, loading } = useInboxConversations(numberId, usuario?.uid ?? "", roles);
  const navigate = useNavigate();
  const [newMsgOpen, setNewMsgOpen] = useState(false);

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Conversaciones</p>
            {!loading && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {conversations.length} activa{conversations.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setNewMsgOpen(true)}
              className="p-1.5 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
              title="Nuevo mensaje"
            >
              <IconEdit className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate(`/whatsapp/${numberId}/templates`)}
              className="p-1.5 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
              title="Gestionar plantillas"
            >
              <IconTemplate className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-10">
            <p className="text-xs text-muted-foreground">Cargando...</p>
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-muted-foreground">
            <IconMessage className="w-7 h-7 opacity-20 mb-2" />
            <p className="text-xs text-center">Sin conversaciones aún</p>
          </div>
        )}

        {conversations.map((conv) => {
          const lastMsg = conv.lastMessages.at(-1);
          const isActive = conv.id === activeConvId;
          const unread = conv.unreadCount ?? 0;
          const hasUnread = unread > 0;
          const windowOpen = isMetaWindowOpen(conv.lastInboundAt as any);

          return (
            <button
              key={conv.id}
              onClick={() => navigate(`/whatsapp/${numberId}/${conv.id}`)}
              className={`w-full text-left px-4 py-3 border-b border-border/60 transition-colors hover:bg-muted/40 ${
                isActive ? "bg-[#004B87]/8 border-l-2 border-l-[#004B87]" : ""
              } ${!windowOpen ? "opacity-60" : ""}`}
            >
              {/* Fila superior: nombre o número + hora */}
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <div className="flex flex-col min-w-0">
                  <span className={`text-sm truncate ${hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
                    {conv.deudorNombre ?? `+${conv.userAddress}`}
                  </span>
                  {conv.deudorNombre && (
                    <span className="text-[10px] text-muted-foreground font-mono truncate">
                      +{conv.userAddress}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0 whitespace-nowrap self-start">
                  {formatTime(conv.lastMessageAt as any)}
                </span>
              </div>

              {/* Fila inferior: preview + indicadores */}
              <div className="flex items-center justify-between gap-2">
                <p className={`text-xs truncate ${hasUnread ? "text-foreground" : "text-muted-foreground"}`}>
                  {lastMsg
                    ? `${lastMsg.source === "AGENT" ? "Tú: " : ""}${lastMsg.text}`
                    : "Sin mensajes"}
                </p>
                {hasUnread ? (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#004B87] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 leading-none">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : !windowOpen ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 bg-muted text-muted-foreground whitespace-nowrap">
                    Solo plantilla
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <NewMessageDialog
        open={newMsgOpen}
        onClose={() => setNewMsgOpen(false)}
        numberId={numberId}
      />
    </div>
  );
}
