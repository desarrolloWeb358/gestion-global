"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Scale,
  Loader2,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";
import { db } from "@/firebase";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { Typography } from "@/shared/design-system/components/Typography";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────────────

type MesesFiltro = "1m" | "2m" | "3m" | "nunca";

interface FilaConjunto {
  clienteId: string;
  clienteNombre: string;
  totalDeudoresEnDemanda: number;
}

interface DeudorDemanda {
  deudorId: string;
  nombre: string;
  clienteId: string;
  clienteNombre: string;
  diasSinRevision: number; // 9999 = nunca revisado
}

const MESES_OPCIONES: { value: MesesFiltro; label: string }[] = [
  { value: "1m", label: "1 mes" },
  { value: "2m", label: "2 meses" },
  { value: "3m", label: "3 meses" },
  { value: "nunca", label: "Nunca revisados" },
];

const DEMANDA_TIPOS = new Set<string>([
  TipificacionDeuda.DEMANDA,
  TipificacionDeuda.DEMANDA_ACUERDO,
  TipificacionDeuda.DEMANDA_INSOLVENCIA,
]);

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  valueColor?: string;
  subtitle?: string;
}

function KpiCard({ icon, iconBg, label, value, valueColor, subtitle }: KpiCardProps) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className={`inline-flex p-2 rounded-lg ${iconBg} mb-3`}>{icon}</div>
      <div className={`text-3xl font-bold mb-0.5 break-all leading-tight ${valueColor ?? "text-brand-primary"}`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground leading-tight">{label}</div>
      {subtitle && (
        <div className="text-xs text-muted-foreground/70 mt-0.5">{subtitle}</div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DependienteDashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { usuario, usuarioSistema, loading: loadingAuth } = useUsuarioActual();

  const [filas, setFilas] = useState<FilaConjunto[]>([]);
  const [todosDemanda, setTodosDemanda] = useState<DeudorDemanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombreParam, setNombreParam] = useState<string | null>(null);

  // Filtro y estados de colapso — secciones cerradas por defecto
  const [mesesFiltro, setMesesFiltro] = useState<MesesFiltro>("1m");
  const [showConjuntos, setShowConjuntos] = useState(false);
  const [showSinRevision, setShowSinRevision] = useState(false);

  const paramUid = searchParams.get("uid");
  const uid = paramUid ?? usuario?.uid;
  const nombreDependiente =
    nombreParam ?? usuarioSistema?.nombre ?? usuario?.displayName ?? "Dependiente";

  const currentDate = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const fetchData = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      if (paramUid) {
        const depDoc = await getDoc(doc(db, "usuarios", paramUid));
        if (depDoc.exists()) {
          const d = depDoc.data();
          setNombreParam((d.nombre as string) ?? (d.email as string) ?? paramUid);
        }
      }

      // 1. Conjuntos asignados a este dependiente
      const clientesSnap = await getDocs(
        query(
          collection(db, "clientes"),
          where("ejecutivoDependienteId", "==", uid),
          where("activo", "==", true)
        )
      );

      const clienteIds = new Set(clientesSnap.docs.map((d) => d.id));
      const clienteNombres = new Map<string, string>();
      clientesSnap.docs.forEach((d) => {
        clienteNombres.set(d.id, (d.data().nombre as string) ?? d.id);
      });

      // 2. Todos los deudores → filtrar por conjuntos del dependiente y tipificación de demanda
      const deudoresSnap = await getDocs(collectionGroup(db, "deudores"));

      const demandaMap = new Map<string, number>();
      const demandaList: DeudorDemanda[] = [];

      deudoresSnap.forEach((doc) => {
        const clienteId = doc.ref.parent.parent?.id;
        if (!clienteId || !clienteIds.has(clienteId)) return;

        const data = doc.data();
        if (!DEMANDA_TIPOS.has(data?.tipificacion)) return;

        demandaMap.set(clienteId, (demandaMap.get(clienteId) ?? 0) + 1);

        const rev = data.fechaUltimaRevision;
        const tieneFecha = rev && typeof rev.toDate === "function";
        const dias = tieneFecha
          ? Math.floor((Date.now() - rev.toDate().getTime()) / (1000 * 60 * 60 * 24))
          : 9999;

        demandaList.push({
          deudorId: doc.id,
          nombre: (data.nombre as string) ?? doc.id,
          clienteId,
          clienteNombre: clienteNombres.get(clienteId) ?? clienteId,
          diasSinRevision: dias,
        });
      });

      // Nunca revisados primero (9999), luego mayor días primero
      demandaList.sort((a, b) => b.diasSinRevision - a.diasSinRevision);
      setTodosDemanda(demandaList);

      const result: FilaConjunto[] = clientesSnap.docs
        .map((doc) => ({
          clienteId: doc.id,
          clienteNombre: clienteNombres.get(doc.id) ?? doc.id,
          totalDeudoresEnDemanda: demandaMap.get(doc.id) ?? 0,
        }))
        .sort((a, b) => b.totalDeudoresEnDemanda - a.totalDeudoresEnDemanda);

      setFilas(result);
    } catch (err) {
      console.error("Error cargando dashboard dependiente:", err);
    } finally {
      setLoading(false);
    }
  }, [uid, paramUid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Totales
  const totalConjuntos = filas.length;
  const totalDeudoresEnDemanda = useMemo(
    () => filas.reduce((s, f) => s + f.totalDeudoresEnDemanda, 0),
    [filas]
  );

  // KPI referencia fija: sin revisión > 30 días
  const sinRevision30d = useMemo(
    () => todosDemanda.filter((d) => d.diasSinRevision >= 30).length,
    [todosDemanda]
  );

  // Lista filtrada según el selector del panel
  const sinRevisionFiltrado = useMemo(() => {
    if (mesesFiltro === "nunca") return todosDemanda.filter((d) => d.diasSinRevision === 9999);
    const umbralMap: Record<MesesFiltro, number> = { "1m": 30, "2m": 60, "3m": 90, "nunca": 0 };
    return todosDemanda.filter((d) => d.diasSinRevision >= umbralMap[mesesFiltro]);
  }, [todosDemanda, mesesFiltro]);

  const labelFiltro = MESES_OPCIONES.find((o) => o.value === mesesFiltro)?.label ?? mesesFiltro;

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">

        {/* ── HEADER ── */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary shadow-lg">
              <LayoutDashboard className="h-7 w-7 text-white" />
            </div>
            <div>
              <Typography variant="h1" className="!text-brand-primary font-bold">
                Dashboard Dependiente
              </Typography>
              <Typography variant="body" className="text-muted-foreground capitalize">
                {currentDate}
              </Typography>
              <Typography variant="small" className="text-muted-foreground/70">
                {nombreDependiente}
              </Typography>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            className="gap-2 self-start md:self-auto"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Actualizar
          </Button>
        </header>

        {/* ── KPI CARDS ── */}
        <section className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <KpiCard
            icon={<Building2 className="h-5 w-5 text-blue-600" />}
            iconBg="bg-blue-100"
            label="Conjuntos asignados"
            value={loading ? "…" : String(totalConjuntos)}
          />
          <KpiCard
            icon={<Scale className="h-5 w-5 text-indigo-600" />}
            iconBg="bg-indigo-100"
            label="Deudores en demanda"
            value={loading ? "…" : String(totalDeudoresEnDemanda)}
            subtitle="Demanda · Acuerdo · Insolvencia"
          />
          <KpiCard
            icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            iconBg="bg-red-100"
            label="Sin revisión > 1 mes"
            value={loading ? "…" : String(sinRevision30d)}
            valueColor={sinRevision30d > 0 ? "text-red-600" : "text-muted-foreground"}
            subtitle="Sin revisión en los últimos 30 días"
          />
        </section>

        {/* ── TABLA POR CONJUNTO ── */}
        <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            className="w-full bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 px-5 py-4 border-b flex items-center justify-between gap-2 hover:bg-brand-primary/5 transition-colors"
            onClick={() => setShowConjuntos((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-brand-primary shrink-0" />
              <div className="text-left">
                <Typography variant="h3" className="!text-brand-secondary font-semibold">
                  Mis conjuntos
                </Typography>
                <Typography variant="small" className="text-muted-foreground">
                  {totalConjuntos} conjuntos · Deudores en demanda por conjunto
                </Typography>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              
              {showConjuntos
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </button>

          {showConjuntos && (
            <div className="overflow-x-auto">
              {loading ? (
                <div className="h-48 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filas.length === 0 ? (
                <div className="h-48 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    No tienes conjuntos asignados actualmente.
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Conjunto
                      </th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                        Deudores en demanda
                      </th>
                      <th className="py-3 px-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((fila) => (
                      <tr
                        key={fila.clienteId}
                        className="border-t hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-3 px-4 font-medium max-w-[240px] truncate">
                          {fila.clienteNombre}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-medium text-indigo-700">
                          {fila.totalDeudoresEnDemanda}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => navigate(`/clientes/${fila.clienteId}`)}
                          >
                            Ver <ExternalLink className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr className="font-semibold">
                      <td className="py-3 px-4 text-sm">
                        Totales ({totalConjuntos} conjuntos)
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-indigo-700">
                        {totalDeudoresEnDemanda}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}
        </section>

        {/* ── DEUDORES SIN REVISIÓN ── */}
        <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            className="w-full bg-gradient-to-r from-red-50 to-orange-50 px-5 py-4 border-b flex items-center justify-between gap-2 hover:from-red-100/60 hover:to-orange-100/60 transition-colors"
            onClick={() => setShowSinRevision((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <div className="text-left">
                <Typography variant="h3" className="!text-red-700 font-semibold">
                  En demanda sin revisión
                </Typography>
                <Typography variant="small" className="text-muted-foreground">
                  {loading
                    ? "Cargando…"
                    : sinRevisionFiltrado.length === 0
                    ? "Todos los deudores están al día"
                    : `${sinRevisionFiltrado.length} deudores · filtro: ${labelFiltro} · Los sin revisión previa aparecen primero`}
                </Typography>
              </div>
            </div>
            {showSinRevision
              ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
          </button>

          {showSinRevision && (
            <>
              <div className="px-5 py-3 border-b bg-slate-50 flex items-center gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Sin revisión en:
                </span>
                <Select value={mesesFiltro} onValueChange={(v) => setMesesFiltro(v as MesesFiltro)}>
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES_OPCIONES.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-x-auto">
                {loading ? (
                  <div className="h-48 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : sinRevisionFiltrado.length === 0 ? (
                  <div className="h-32 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Sin deudores en alerta.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Deudor
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Conjunto
                        </th>
                        <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                          Días sin revisión
                        </th>
                        <th className="py-3 px-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {sinRevisionFiltrado.map((d) => (
                        <tr
                          key={d.deudorId}
                          className="border-t hover:bg-slate-50/70 transition-colors cursor-pointer"
                          onClick={() => navigate(`/clientes/${d.clienteId}/deudores/${d.deudorId}`)}
                        >
                          <td className="py-3 px-4 font-medium max-w-[200px] truncate">
                            {d.nombre}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground max-w-[180px] truncate">
                            {d.clienteNombre}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {d.diasSinRevision === 9999 ? (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700">
                                Nunca
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700">
                                {d.diasSinRevision}d
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </section>

      </div>
    </div>
  );
}
