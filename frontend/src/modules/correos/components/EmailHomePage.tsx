import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconChevronRight, IconMail } from "@tabler/icons-react";
import { httpsCallable } from "firebase/functions";
import { Input } from "@/shared/ui/input";
import { functions } from "@/firebase";
import { listarClientesWhatsapp, type ClienteOption } from "@/modules/clientes/services/clienteService";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";

export default function EmailHomePage() {
  const navigate = useNavigate();
  const { usuario, roles, loading: userLoading } = useUsuarioActual();
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState<Array<{
    id: string;
    conjunto: string;
    mode: "bulk" | "individual" | "conjunto";
    subject: string;
    body: string;
    total: number;
    sent: number;
    failed: number;
    status: string;
    createdAtMs: number;
  }>>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading) return;
    if (!usuario?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    listarClientesWhatsapp(usuario.uid, roles)
      .then(setClientes)
      .finally(() => setLoading(false));
  }, [usuario?.uid, roles, userLoading]);

  useEffect(() => {
    if (userLoading || !usuario?.uid) return;
    const loadHistory = httpsCallable<undefined, { campaigns: typeof history }>(functions, "getEmailCampaignHistory");
    setHistoryLoading(true);
    loadHistory()
      .then((response) => setHistory(response.data.campaigns))
      .finally(() => setHistoryLoading(false));
  }, [usuario?.uid, userLoading]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return term ? clientes.filter((cliente) => cliente.nombre.toLocaleLowerCase("es").includes(term)) : clientes;
  }, [clientes, search]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <IconMail className="w-6 h-6 text-blue-600" />
          Correos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecciona un conjunto para preparar una comunicación masiva con plantilla.
        </p>
      </div>

      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar conjunto..." />

      {loading && <p className="text-sm text-muted-foreground">Cargando conjuntos...</p>}
      {!loading && filtered.length === 0 && (
        <div className="border border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
          No se encontraron conjuntos disponibles.
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((cliente) => (
          <div key={cliente.id} className="rounded-lg border bg-background p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <IconMail className="w-5 h-5 text-blue-600" />
            </div>
            <span className="flex-1 min-w-0 text-sm font-medium truncate">{cliente.nombre}</span>
            <button onClick={() => navigate(`/clientes/${cliente.id}/enviar-correos?destino=conjunto`)} className="rounded-md border px-3 py-2 text-xs hover:bg-muted">Al conjunto</button>
            <button onClick={() => navigate(`/clientes/${cliente.id}/enviar-correos`)} className="rounded-md bg-brand-primary text-white px-3 py-2 text-xs flex items-center gap-1">A deudores<IconChevronRight className="w-3 h-3" /></button>
          </div>
        ))}
      </div>

      <section className="pt-4 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Historial de envíos</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Fecha, contenido y resultado de las campañas realizadas en tus conjuntos.
          </p>
        </div>
        {historyLoading && <p className="text-sm text-muted-foreground">Cargando historial...</p>}
        {!historyLoading && history.length === 0 && (
          <div className="border border-dashed rounded-lg p-6 text-center text-sm text-muted-foreground">
            Aún no hay campañas de correo registradas.
          </div>
        )}
        {history.map((campaign) => (
          <div key={campaign.id} className="rounded-lg border bg-background overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedId((current) => current === campaign.id ? null : campaign.id)}
              className="w-full p-4 text-left hover:bg-muted/40 transition-colors"
            >
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{campaign.subject || "Sin asunto"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {campaign.conjunto || "Conjunto sin nombre"} · {campaign.mode === "bulk" ? "Masivo" : campaign.mode === "conjunto" ? "Al conjunto" : "Individual"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  {campaign.createdAtMs ? new Date(campaign.createdAtMs).toLocaleString("es-CO") : "Procesando"}
                </p>
              </div>
              <div className="flex gap-3 mt-2 text-xs">
                <span className="text-green-700">Enviados: {campaign.sent}</span>
                <span className={campaign.failed ? "text-red-700" : "text-muted-foreground"}>Fallidos: {campaign.failed}</span>
                <span className="text-muted-foreground">Total: {campaign.total}</span>
              </div>
            </button>
            {expandedId === campaign.id && (
              <div className="border-t bg-muted/20 px-4 py-4">
                <p className="text-xs font-semibold mb-2">Contenido enviado</p>
                <div className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{campaign.body || "El contenido no está disponible para este envío anterior."}</div>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
