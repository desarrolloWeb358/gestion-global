import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconUser, IconLink, IconExternalLink,
  IconChevronRight, IconChevronLeft, IconSearch, IconUnlink,
} from "@tabler/icons-react";
import { Mail, IdCard, DollarSign, FileCheck } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import { useConversation } from "../hooks/useConversation";
import { linkDeudorToConversation, getDeudorDoc, unlinkDeudorFromConversation } from "../services/conversationsService";
import { listarClientesBasico, getClienteById, type ClienteOption } from "@/modules/clientes/services/clienteService";
import { escucharUltimoEstadoMensual } from "@/modules/cobranza/services/estadoMensualService";
import { obtenerAcuerdoActual } from "@/modules/cobranza/services/acuerdoPagoService";
import { ACUERDO_ESTADO } from "@/shared/constants/acuerdoEstado";
import type { EstadoMensual } from "@/modules/cobranza/models/estadoMensual.model";

interface Props {
  numberId: string;
  convId?: string;
}

interface DeudorOption {
  id: string;
  nombre: string;
  telefonos: string[];
  tipificacion?: string;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

function DataCard({
  bg, border, iconBg, iconColor, icon, label, value, sub,
}: {
  bg: string; border: string; iconBg: string; iconColor: string;
  icon: React.ReactNode; label: string; value: string; sub?: string;
}) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${bg} border ${border}`}>
      <div className={`p-1.5 rounded-lg bg-white shadow-sm flex-shrink-0`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-gray-700 leading-snug break-all">{value}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Sección vinculada ────────────────────────────────────────────────────
function LinkedView({
  numberId,
  convId,
  clienteId,
  deudorId,
  onNavigate,
}: {
  numberId: string;
  convId: string;
  clienteId: string;
  deudorId: string;
  onNavigate: () => void;
}) {
  const [deudor, setDeudor] = useState<Record<string, any> | null>(null);
  const [clienteNombre, setClienteNombre] = useState("");
  const [estadoMes, setEstadoMes] = useState<EstadoMensual | null>(null);
  const [acuerdoActivo, setAcuerdoActivo] = useState<boolean | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    getDeudorDoc(clienteId, deudorId).then(setDeudor);
    getClienteById(clienteId).then((c) => setClienteNombre(c?.nombre ?? ""));

    const unsub = escucharUltimoEstadoMensual(clienteId, deudorId, setEstadoMes);

    obtenerAcuerdoActual(clienteId, deudorId).then(({ acuerdo }) => {
      setAcuerdoActivo(acuerdo?.estado === ACUERDO_ESTADO.EN_FIRME);
    });

    return unsub;
  }, [clienteId, deudorId]);

  if (!deudor) return <p className="text-xs text-muted-foreground p-4">Cargando...</p>;

  const correo = Array.isArray(deudor.correos) ? deudor.correos[0] : undefined;
  const documento = deudor.cedula;

  return (
    <div className="p-4 space-y-3">
      {/* Nombre + tipificación + desasociar */}
      <div className="pb-1 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-foreground leading-snug">{deudor.nombre}</p>
          <button
            onClick={async () => {
              if (!confirm("¿Desasociar este deudor de la conversación?")) return;
              setUnlinking(true);
              try { await unlinkDeudorFromConversation(numberId, convId, clienteId, deudorId, convId); }
              finally { setUnlinking(false); }
            }}
            disabled={unlinking}
            className="flex-shrink-0 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            title="Desasociar deudor"
          >
            <IconUnlink className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {deudor.tipificacion && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 border border-orange-100 text-orange-600 font-medium">
              {deudor.tipificacion}
            </span>
          )}
          {deudor.ubicacion && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 font-medium">
              {deudor.ubicacion}
            </span>
          )}
          {clienteNombre && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-500 font-medium">
              {clienteNombre}
            </span>
          )}
        </div>
      </div>

      {/* Cards de datos */}
      <div className="space-y-2">
        {correo && (
          <DataCard
            bg="bg-blue-50" border="border-blue-100" iconBg="" iconColor="text-blue-600"
            icon={<Mail className="h-4 w-4" />}
            label="Correo electrónico"
            value={correo}
          />
        )}

        {documento && (
          <DataCard
            bg="bg-purple-50" border="border-purple-100" iconBg="" iconColor="text-purple-600"
            icon={<IdCard className="h-4 w-4" />}
            label="Documento"
            value={documento}
          />
        )}

        <div className="rounded-lg border border-blue-100 bg-blue-50 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-100">
            <div className="p-1 rounded-md bg-white shadow-sm">
              <DollarSign className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide">
              Deuda
            </p>
            {estadoMes?.mes && (
              <span className="ml-auto text-[10px] text-blue-400">Mes: {estadoMes.mes}</span>
            )}
          </div>

          {estadoMes ? (
            <div className="divide-y divide-blue-100">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-gray-500">Deuda</span>
                <span className="text-sm font-semibold text-gray-700">{money(estadoMes.deuda)}</span>
              </div>
              {(estadoMes.honorariosDeuda ?? 0) > 0 && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-gray-500">
                    Honorarios{estadoMes.porcentajeHonorarios ? ` (${estadoMes.porcentajeHonorarios}%)` : ""}
                  </span>
                  <span className="text-sm font-semibold text-amber-600">{money(estadoMes.honorariosDeuda!)}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-3 py-2.5 bg-blue-100/60">
                <span className="text-xs font-semibold text-gray-600">Total</span>
                <span className="text-sm font-bold text-blue-700">
                  {money(estadoMes.deuda + (estadoMes.honorariosDeuda ?? 0))}
                </span>
              </div>
            </div>
          ) : (
            <p className="px-3 py-2.5 text-xs text-gray-400">Sin estados mensuales</p>
          )}
        </div>

        {acuerdoActivo !== null && (
          <div
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              acuerdoActivo
                ? "bg-green-50 border-green-100"
                : "bg-gray-50 border-gray-100"
            }`}
          >
            <div className="p-1.5 rounded-lg bg-white shadow-sm flex-shrink-0">
              <FileCheck className={`h-4 w-4 ${acuerdoActivo ? "text-green-600" : "text-gray-400"}`} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 mb-0.5">Acuerdo de pago</p>
              <p className={`text-sm font-semibold ${acuerdoActivo ? "text-green-700" : "text-gray-500"}`}>
                {acuerdoActivo ? "En firme" : "Sin acuerdo activo"}
              </p>
            </div>
          </div>
        )}
      </div>

      <Button variant="outline" size="sm" className="w-full gap-2 text-xs mt-1" onClick={onNavigate}>
        <IconExternalLink className="w-3.5 h-3.5" />
        Ver deudor completo
      </Button>
    </div>
  );
}

// ── Flujo de vinculación ─────────────────────────────────────────────────
function LinkFlow({
  numberId,
  convId,
  phone,
}: {
  numberId: string;
  convId: string;
  phone: string;
}) {
  const [step, setStep] = useState<"cliente" | "deudor">("cliente");

  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<ClienteOption | null>(null);

  const [deudores, setDeudores] = useState<DeudorOption[]>([]);
  const [deudorSearch, setDeudorSearch] = useState("");
  const [loadingDeudores, setLoadingDeudores] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    listarClientesBasico().then(setClientes);
  }, []);

  const filteredClientes = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(clienteSearch.toLowerCase())
  );

  const handleSelectCliente = useCallback(async (cliente: ClienteOption) => {
    setSelectedCliente(cliente);
    setStep("deudor");
    setDeudorSearch("");
    setLoadingDeudores(true);
    try {
      const snap = await getDocs(collection(db, `clientes/${cliente.id}/deudores`));
      const list: DeudorOption[] = snap.docs.map((d) => ({
        id: d.id,
        nombre: d.data().nombre ?? d.id,
        telefonos: d.data().telefonos ?? [],
        tipificacion: d.data().tipificacion ?? "",
      }));
      list.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
      setDeudores(list);
    } finally {
      setLoadingDeudores(false);
    }
  }, []);

  const handleLink = useCallback(async (deudor: DeudorOption) => {
    if (!selectedCliente) return;
    setLinking(true);
    try {
      await linkDeudorToConversation(
        numberId,
        convId,
        selectedCliente.id,
        deudor.id,
        deudor.nombre,
        phone
      );
    } finally {
      setLinking(false);
    }
  }, [numberId, convId, selectedCliente, phone]);

  // ── Step 1: buscar cliente ─────────────────────────────────────────
  if (step === "cliente") {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <IconLink className="w-4 h-4" />
          <p className="text-xs font-medium">Vincular deudor</p>
        </div>

        <div className="relative">
          <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={clienteSearch}
            onChange={(e) => setClienteSearch(e.target.value)}
            className="h-8 text-xs pl-7"
            autoFocus
          />
        </div>

        <div className="space-y-0.5 max-h-72 overflow-y-auto">
          {filteredClientes.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">Sin resultados</p>
          )}
          {filteredClientes.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelectCliente(c)}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/60 transition-colors flex items-start justify-between gap-2"
            >
              <span className="text-sm text-foreground leading-snug">{c.nombre}</span>
              <IconChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Step 2: seleccionar deudor ─────────────────────────────────────
  const filteredDeudores = deudores.filter((d) =>
    d.nombre.toLowerCase().includes(deudorSearch.toLowerCase())
  );

  return (
    <div className="p-4 space-y-3">
      <button
        onClick={() => { setStep("cliente"); setSelectedCliente(null); setDeudores([]); setDeudorSearch(""); }}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <IconChevronLeft className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="leading-snug">{selectedCliente?.nombre}</span>
      </button>

      {loadingDeudores ? (
        <p className="text-xs text-muted-foreground">Cargando deudores...</p>
      ) : (
        <>
          <div className="relative">
            <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar deudor..."
              value={deudorSearch}
              onChange={(e) => setDeudorSearch(e.target.value)}
              className="h-8 text-xs pl-7"
              autoFocus
            />
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {filteredDeudores.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">
                {deudorSearch ? "Sin resultados" : "Sin deudores registrados"}
              </p>
            )}
            {filteredDeudores.map((d) => (
              <div key={d.id} className="border border-border rounded-md px-3 py-2.5 space-y-1">
                <p className="text-sm font-medium text-foreground leading-snug">{d.nombre}</p>
                {d.tipificacion && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {d.tipificacion}
                  </span>
                )}
                <Button
                  size="sm"
                  className="w-full h-7 text-xs gap-1 mt-1"
                  onClick={() => handleLink(d)}
                  disabled={linking}
                >
                  <IconLink className="w-3 h-3" />
                  {linking ? "Vinculando..." : "Vincular"}
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────
export function LeadPanel({ numberId, convId }: Props) {
  const navigate = useNavigate();
  const conversation = useConversation(numberId, convId ?? "");

  if (!convId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-muted-foreground">
        <IconUser className="w-8 h-8 opacity-20 mb-2" />
        <p className="text-xs text-center">Selecciona una conversación</p>
      </div>
    );
  }

  const isLinked = !!(conversation?.clienteId && conversation?.deudorId);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {isLinked ? (
          <LinkedView
            numberId={numberId}
            convId={convId}
            clienteId={conversation!.clienteId!}
            deudorId={conversation!.deudorId!}
            onNavigate={() =>
              navigate(`/clientes/${conversation!.clienteId}/deudores/${conversation!.deudorId}`)
            }
          />
        ) : (
          <LinkFlow
            numberId={numberId}
            convId={convId}
            phone={convId}
          />
        )}
      </div>
    </div>
  );
}
