import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { IconMessage, IconTemplate, IconEdit, IconSearch, IconX, IconChevronLeft } from "@tabler/icons-react";
import { useInboxConversations } from "../hooks/useInboxConversations";
import { useConversationSearch, type SearchMode } from "../hooks/useConversationSearch";
import { isMetaWindowOpen } from "../services/conversationsService";
import { NewMessageDialog } from "./NewMessageDialog";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { listarClientesWhatsapp, type ClienteOption } from "@/modules/clientes/services/clienteService";

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

const MODES: { key: SearchMode; label: string }[] = [
  { key: "phone",   label: "Número"   },
  { key: "cliente", label: "Conjunto" },
];

export function InboxPanel({ numberId, activeConvId }: Props) {
  const { usuario, roles, loading: rolesLoading } = useUsuarioActual();
  const uid = rolesLoading ? "" : (usuario?.uid ?? "");
  const { conversations, loading } = useInboxConversations(numberId, uid, roles);
  const navigate = useNavigate();
  const [newMsgOpen, setNewMsgOpen] = useState(false);

  // ── Búsqueda ──────────────────────────────────────────────────────────
  const [mode, setMode] = useState<SearchMode>("phone");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");

  // Para modo "cliente": lista de conjuntos y el seleccionado
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<ClienteOption | null>(null);
  const clientesLoaded = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTerm(searchInput.trim()), 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Cargar clientes la primera vez que se abre ese modo
  useEffect(() => {
    if (mode === "cliente" && !clientesLoaded.current && uid) {
      clientesLoaded.current = true;
      listarClientesWhatsapp(uid, roles).then(setClientes);
    }
  }, [mode, uid, roles]);

  // Al cambiar de modo limpiar estado
  const handleModeChange = (m: SearchMode) => {
    setMode(m);
    setSearchInput("");
    setDebouncedTerm("");
    setClienteSearch("");
    setSelectedCliente(null);
  };

  const { results: searchResults, loading: searchLoading } = useConversationSearch(
    numberId,
    mode,
    debouncedTerm,
    uid,
    roles,
    selectedCliente?.id
  );

  const isSearchActive =
    mode === "cliente"
      ? !!selectedCliente
      : debouncedTerm.length >= 3;

  const displayConversations = isSearchActive ? searchResults : conversations;
  const isLoading = isSearchActive ? searchLoading : loading;

  // Lista de clientes filtrada por lo que escribe el usuario
  const filteredClientes = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(clienteSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Conversaciones</p>
            {!loading && !isSearchActive && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {conversations.length} activa{conversations.length !== 1 ? "s" : ""}
              </p>
            )}
            {isSearchActive && !searchLoading && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""}
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

        {/* Selector de modo */}
        <div className="flex gap-1 bg-muted/50 rounded-md p-0.5">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => handleModeChange(m.key)}
              className={`flex-1 text-[11px] py-1 rounded-sm font-medium transition-colors ${
                mode === m.key
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Input según modo */}
        {mode === "phone" && (
          <div className="relative">
            <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              inputMode="numeric"
              placeholder="Buscar por número..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-[#004B87]/50 placeholder:text-muted-foreground"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <IconX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {mode === "cliente" && !selectedCliente && (
          <div className="relative">
            <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar conjunto..."
              value={clienteSearch}
              onChange={(e) => setClienteSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-[#004B87]/50 placeholder:text-muted-foreground"
            />
            {clienteSearch && (
              <button
                onClick={() => setClienteSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <IconX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {mode === "cliente" && selectedCliente && (
          <button
            onClick={() => setSelectedCliente(null)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <IconChevronLeft className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate font-medium">{selectedCliente.nombre}</span>
          </button>
        )}
      </div>

      {/* Lista de clientes (solo modo "cliente" sin selección) */}
      {mode === "cliente" && !selectedCliente && (
        <div className="flex-1 overflow-y-auto">
          {clientes.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <p className="text-xs text-muted-foreground">Cargando conjuntos...</p>
            </div>
          )}
          {filteredClientes.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCliente(c)}
              className="w-full text-left px-4 py-3 border-b border-border/60 hover:bg-muted/40 transition-colors"
            >
              <p className="text-sm text-foreground leading-snug">{c.nombre}</p>
            </button>
          ))}
          {clientes.length > 0 && filteredClientes.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <p className="text-xs text-muted-foreground">Sin resultados</p>
            </div>
          )}
        </div>
      )}

      {/* Lista de conversaciones */}
      {(mode !== "cliente" || selectedCliente) && (
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <p className="text-xs text-muted-foreground">Cargando...</p>
            </div>
          )}

          {!isLoading && displayConversations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-muted-foreground">
              <IconMessage className="w-7 h-7 opacity-20 mb-2" />
              <p className="text-xs text-center">
                {isSearchActive ? "Sin conversaciones para esta búsqueda" : "Sin conversaciones aún"}
              </p>
            </div>
          )}

          {displayConversations.map((conv) => {
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
      )}

      <NewMessageDialog
        open={newMsgOpen}
        onClose={() => setNewMsgOpen(false)}
        numberId={numberId}
      />
    </div>
  );
}
