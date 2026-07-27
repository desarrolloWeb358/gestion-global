import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { IconMessage, IconTemplate, IconEdit, IconSearch, IconX, IconChevronLeft } from "@tabler/icons-react";
import { useInboxConversations, type InboxScope } from "../hooks/useInboxConversations";
import { useMiCartera } from "../hooks/useMiCartera";
import { useConversationSearch, type SearchMode } from "../hooks/useConversationSearch";
import { isMetaWindowOpen } from "../services/conversationsService";
import { NewMessageDialog } from "./NewMessageDialog";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { listarClientesWhatsapp, type ClienteOption } from "@/modules/clientes/services/clienteService";
import { obtenerEjecutivos } from "@/modules/usuarios/services/usuarioService";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import type { WaConversation } from "../models/waConversation.model";
import { searchConversationsByEjecutivoId } from "../services/conversationsService";

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

const SCOPES: { key: InboxScope; label: string; title: string }[] = [
  { key: "mine",       label: "Mías",        title: "Conversaciones de mis conjuntos" },
  { key: "all",        label: "Todas",       title: "Todas las conversaciones del número" },
  { key: "unassigned", label: "Sin asignar", title: "Conversaciones sin conjunto vinculado" },
];

// Posición del scroll de la lista, guardada FUERA de React a propósito: abrir
// una conversación cambia la ruta y el panel se vuelve a montar, con lo que el
// scrollTop del contenedor se pierde. Un useRef se perdería con él.
const scrollMemory = new Map<string, number>();

export function InboxPanel({ numberId, activeConvId }: Props) {
  const { usuario, roles, loading: rolesLoading } = useUsuarioActual();
  const uid = rolesLoading ? "" : (usuario?.uid ?? "");
  const navigate = useNavigate();
  const [newMsgOpen, setNewMsgOpen] = useState(false);

  const isEjecutivoAdmin = roles.includes("ejecutivoAdmin");
  const isFullAccess =
    roles.includes("admin") || roles.includes("supervisor") || isEjecutivoAdmin;

  // ── Alcance de la bandeja ─────────────────────────────────────────────
  // Solo elige quien tiene acceso total Y cartera propia. Un ejecutivo puro
  // ve lo suyo; un admin sin conjuntos a cargo ve todo, como hasta ahora.
  const { tieneCartera, loading: carteraLoading } = useMiCartera(uid);
  const puedeElegirScope = isFullAccess && tieneCartera;

  // Siempre arranca en "Mías". No se recuerda entre visitas a propósito: lo
  // normal al entrar es atender lo propio, y encontrarse la bandeja completa
  // sin haberla pedido desorienta.
  const [scopePref, setScopePref] = useState<InboxScope>("mine");

  const handleScopeChange = (s: InboxScope) => {
    setScopePref(s);
    // El alcance gobierna la bandeja, no los resultados de una búsqueda: si
    // había una activa se cierra, que es lo que el usuario está pidiendo al
    // tocar el chip.
    resetSearch("phone");
  };

  const scope: InboxScope | null = carteraLoading
    ? null
    : puedeElegirScope
    ? scopePref
    : isFullAccess
    ? "all"
    : "mine";

  const { conversations, loading } = useInboxConversations(numberId, uid, scope);

  const activeRowRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // ── Filtro "solo sin leer" (aplica a la bandeja, no a las búsquedas) ──
  const [onlyUnread, setOnlyUnread] = useState(false);
  const unreadTotal = conversations.filter((c) => (c.unreadCount ?? 0) > 0).length;

  useEffect(() => {
    if (unreadTotal === 0) setOnlyUnread(false);
  }, [unreadTotal]);

  const MODES: { key: SearchMode; label: string }[] = [
    { key: "phone",   label: "Número"   },
    { key: "cliente", label: "Conjunto" },
    ...(isEjecutivoAdmin ? [{ key: "ejecutivo" as SearchMode, label: "Ejecutivo" }] : []),
  ];

  // ── Búsqueda ──────────────────────────────────────────────────────────
  const [mode, setMode] = useState<SearchMode>("phone");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");

  // Para modo "cliente": lista de conjuntos y el seleccionado
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<ClienteOption | null>(null);
  const clientesLoaded = useRef(false);

  // Para modo "ejecutivo": lista de ejecutivos y el seleccionado
  const [ejecutivos, setEjecutivos] = useState<UsuarioSistema[]>([]);
  const [ejecutivoSearch, setEjecutivoSearch] = useState("");
  const [selectedEjecutivo, setSelectedEjecutivo] = useState<UsuarioSistema | null>(null);
  const ejecutivosLoaded = useRef(false);
  const [ejecutivoLoading, setEjecutivoLoading] = useState(false);
  const [ejecutivoFilteredConvs, setEjecutivoFilteredConvs] = useState<WaConversation[]>([]);

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

  // Cargar ejecutivos la primera vez que se abre ese modo
  useEffect(() => {
    if (mode === "ejecutivo" && !ejecutivosLoaded.current) {
      ejecutivosLoaded.current = true;
      obtenerEjecutivos().then(setEjecutivos);
    }
  }, [mode]);

  // Cargar conversaciones del ejecutivo seleccionado directo desde Firestore
  useEffect(() => {
    if (mode !== "ejecutivo" || !selectedEjecutivo) {
      setEjecutivoFilteredConvs([]);
      return;
    }
    let cancelled = false;
    setEjecutivoLoading(true);

    searchConversationsByEjecutivoId(numberId, selectedEjecutivo.uid).then((convs) => {
      if (!cancelled) {
        setEjecutivoFilteredConvs(convs);
        setEjecutivoLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [selectedEjecutivo, numberId, mode]);

  // Deja la búsqueda en blanco y vuelve a mostrar la bandeja
  function resetSearch(m: SearchMode) {
    setMode(m);
    setSearchInput("");
    setDebouncedTerm("");
    setClienteSearch("");
    setSelectedCliente(null);
    setEjecutivoSearch("");
    setSelectedEjecutivo(null);
  }

  const handleModeChange = (m: SearchMode) => resetSearch(m);

  const { results: searchResults, loading: searchLoading } = useConversationSearch(
    numberId,
    mode,
    debouncedTerm,
    uid,
    roles,
    selectedCliente?.id
  );

  const isSearchActive =
    mode === "ejecutivo"
      ? !!selectedEjecutivo
      : mode === "cliente"
      ? !!selectedCliente
      : debouncedTerm.length >= 3;

  const displayConversations =
    mode === "ejecutivo" && selectedEjecutivo
      ? ejecutivoFilteredConvs
      : isSearchActive
      ? searchResults
      : onlyUnread
      ? conversations.filter((c) => (c.unreadCount ?? 0) > 0)
      : conversations;

  const isLoading =
    mode === "ejecutivo" && selectedEjecutivo
      ? ejecutivoLoading
      : isSearchActive
      ? searchLoading
      : loading;

  // ── Conservación del scroll de la lista ───────────────────────────────
  // Una entrada por cada lista distinta: cambiar de alcance o de modo de
  // búsqueda muestra otro contenido y merece su propia posición.
  const scrollKey = `${numberId}|${scope ?? ""}|${mode}|${onlyUnread ? "unread" : "all"}`;

  const saveScroll = (e: React.UIEvent<HTMLDivElement>) => {
    scrollMemory.set(scrollKey, e.currentTarget.scrollTop);
  };

  // Antes de pintar, para que no se vea el salto. Depende del número de filas
  // porque en el primer render la lista aún está vacía y no hay a dónde bajar.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || displayConversations.length === 0) return;

    const guardado = scrollMemory.get(scrollKey);
    if (guardado != null && el.scrollTop !== guardado) el.scrollTop = guardado;
  }, [scrollKey, displayConversations.length]);

  // Red de seguridad para cuando se abre una conversación sin haberla clicado
  // en la lista (enlace directo, recarga del navegador). block:"nearest" no
  // hace nada si ya quedó visible tras restaurar el scroll.
  useEffect(() => {
    if (!activeConvId) return;
    activeRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeConvId]);

  // Lista de clientes filtrada por lo que escribe el usuario
  const filteredClientes = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(clienteSearch.toLowerCase())
  );

  // Lista de ejecutivos filtrada
  const filteredEjecutivos = ejecutivos.filter((e) =>
    (e.nombre ?? "").toLowerCase().includes(ejecutivoSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Conversaciones</p>
            {!loading && !isSearchActive && (
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <span>
                  {conversations.length} cargada{conversations.length !== 1 ? "s" : ""}
                </span>
                {unreadTotal > 0 && (
                  <>
                    <span>·</span>
                    <button
                      onClick={() => setOnlyUnread((v) => !v)}
                      title={onlyUnread ? "Ver todas" : "Ver solo sin leer"}
                      className={`rounded px-1 -mx-0.5 font-semibold transition-colors ${
                        onlyUnread
                          ? "bg-[#004B87] text-white"
                          : "text-[#004B87] hover:bg-[#004B87]/10"
                      }`}
                    >
                      {unreadTotal} sin leer
                    </button>
                  </>
                )}
              </div>
            )}
            {isSearchActive && !isLoading && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {displayConversations.length} resultado{displayConversations.length !== 1 ? "s" : ""}
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

        {/* Selector de alcance (solo acceso total + cartera propia) */}
        {puedeElegirScope && (
          <div className="flex gap-1">
            {SCOPES.map((s) => (
              <button
                key={s.key}
                onClick={() => handleScopeChange(s.key)}
                title={s.title}
                className={`flex-1 text-[11px] py-1 px-1 rounded-md border font-medium transition-colors ${
                  // Durante una búsqueda ningún alcance está gobernando la
                  // lista: dejarlo marcado hace creer que sí.
                  !isSearchActive && scope === s.key
                    ? "border-[#004B87] bg-[#004B87] text-white"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

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

        {mode === "ejecutivo" && !selectedEjecutivo && (
          <div className="relative">
            <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar ejecutivo..."
              value={ejecutivoSearch}
              onChange={(e) => setEjecutivoSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-[#004B87]/50 placeholder:text-muted-foreground"
            />
            {ejecutivoSearch && (
              <button
                onClick={() => setEjecutivoSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <IconX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {mode === "ejecutivo" && selectedEjecutivo && (
          <button
            onClick={() => setSelectedEjecutivo(null)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <IconChevronLeft className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate font-medium">{selectedEjecutivo.nombre}</span>
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

      {/* Lista de ejecutivos (solo modo "ejecutivo" sin selección) */}
      {mode === "ejecutivo" && !selectedEjecutivo && (
        <div className="flex-1 overflow-y-auto">
          {ejecutivos.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <p className="text-xs text-muted-foreground">Cargando ejecutivos...</p>
            </div>
          )}
          {filteredEjecutivos.map((e) => (
            <button
              key={e.uid}
              onClick={() => setSelectedEjecutivo(e)}
              className="w-full text-left px-4 py-3 border-b border-border/60 hover:bg-muted/40 transition-colors"
            >
              <p className="text-sm text-foreground leading-snug">{e.nombre}</p>
            </button>
          ))}
          {ejecutivos.length > 0 && filteredEjecutivos.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <p className="text-xs text-muted-foreground">Sin resultados</p>
            </div>
          )}
        </div>
      )}

      {/* Lista de conversaciones */}
      {(mode === "phone" || (mode === "cliente" && !!selectedCliente) || (mode === "ejecutivo" && !!selectedEjecutivo)) && (
        <div ref={listRef} onScroll={saveScroll} className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <p className="text-xs text-muted-foreground">Cargando...</p>
            </div>
          )}

          {!isLoading && displayConversations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-muted-foreground">
              <IconMessage className="w-7 h-7 opacity-20 mb-2" />
              <p className="text-xs text-center">
                {isSearchActive
                  ? "Sin conversaciones para esta búsqueda"
                  : onlyUnread
                  ? "No hay conversaciones sin leer"
                  : scope === "unassigned"
                  ? "No hay conversaciones sin asignar"
                  : scope === "mine"
                  ? "No tienes conversaciones en tus conjuntos"
                  : "Sin conversaciones aún"}
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
                ref={isActive ? activeRowRef : undefined}
                onClick={() => navigate(`/whatsapp/${numberId}/${conv.id}`)}
                className={`w-full text-left px-4 py-3 border-b border-border/60 transition-colors ${
                  isActive
                    ? "bg-[#004B87] border-l-4 border-l-[#00305a] pl-3 shadow-sm"
                    : "border-l-4 border-l-transparent pl-3 hover:bg-muted/40"
                } ${!windowOpen && !isActive ? "opacity-60" : ""}`}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <div className="flex flex-col min-w-0">
                    <span
                      className={`text-sm truncate ${
                        isActive
                          ? "font-bold text-white"
                          : hasUnread
                          ? "font-semibold text-foreground"
                          : "font-medium text-foreground"
                      }`}
                    >
                      {conv.deudorNombre ?? `+${conv.userAddress}`}
                    </span>
                    {conv.deudorNombre && (
                      <span
                        className={`text-[10px] font-mono truncate ${
                          isActive ? "text-white/70" : "text-muted-foreground"
                        }`}
                      >
                        +{conv.userAddress}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] flex-shrink-0 whitespace-nowrap self-start ${
                      isActive ? "text-white/70" : "text-muted-foreground"
                    }`}
                  >
                    {formatTime(conv.lastMessageAt as any)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`text-xs truncate ${
                      isActive
                        ? "text-white/85"
                        : hasUnread
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {lastMsg
                      ? `${lastMsg.source === "AGENT" ? "Tú: " : ""}${lastMsg.text}`
                      : "Sin mensajes"}
                  </p>
                  {hasUnread ? (
                    <span
                      className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 leading-none ${
                        isActive ? "bg-white text-[#004B87]" : "bg-[#004B87] text-white"
                      }`}
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  ) : !windowOpen ? (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap ${
                        isActive ? "bg-white/20 text-white/90" : "bg-muted text-muted-foreground"
                      }`}
                    >
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
