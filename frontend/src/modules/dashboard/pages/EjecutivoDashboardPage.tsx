"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Building2,
  Handshake,
  Loader2,
  ExternalLink,
  RefreshCw,
  TrendingUp,
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

const pct = (num: number, den: number) =>
  den > 0 ? Math.round((num / den) * 100) : 0;

// ─── Types ────────────────────────────────────────────────────────────────────

type DiasFiltro = "15" | "30" | "60" | "nunca";

interface FilaConjunto {
  clienteId: string;
  clienteNombre: string;
  totalDeudores: number;
  totalAcuerdos: number;
  pctAcuerdos: number;
}

interface DeudorGestionando {
  deudorId: string;
  nombre: string;
  clienteId: string;
  clienteNombre: string;
  diasSinGestion: number; // 9999 = nunca gestionado
}

const DIAS_OPCIONES: { value: DiasFiltro; label: string }[] = [
  { value: "15", label: "15 días" },
  { value: "30", label: "30 días" },
  { value: "60", label: "60 días" },
  { value: "nunca", label: "Solo sin gestión" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  valueColor?: string;
  subtitle?: string;
  small?: boolean;
}

function KpiCard({ icon, iconBg, label, value, valueColor, subtitle, small }: KpiCardProps) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className={`inline-flex p-2 rounded-lg ${iconBg} mb-3`}>{icon}</div>
      <div
        className={`font-bold mb-0.5 break-all leading-tight ${small ? "text-lg" : "text-3xl"} ${
          valueColor ?? "text-brand-primary"
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground leading-tight">{label}</div>
      {subtitle && (
        <div className="text-xs text-muted-foreground/70 mt-0.5">{subtitle}</div>
      )}
    </div>
  );
}

function AcuerdoBadge({ value }: { value: number }) {
  const color =
    value >= 50
      ? "bg-green-100 text-green-700"
      : value >= 25
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {value}%
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EjecutivoDashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { usuario, usuarioSistema, loading: loadingAuth } = useUsuarioActual();

  const [filas, setFilas] = useState<FilaConjunto[]>([]);
  const [todosGestionando, setTodosGestionando] = useState<DeudorGestionando[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombreParam, setNombreParam] = useState<string | null>(null);

  // Filtro de días y estados de colapso
  const [diasFiltro, setDiasFiltro] = useState<DiasFiltro>("15");
  const [showConjuntos, setShowConjuntos] = useState(true);
  const [showSinGestion, setShowSinGestion] = useState(true);

  // Si el admin navega con ?uid=xxx se usa ese UID; si no, el propio usuario
  const paramUid = searchParams.get("uid");
  const uid = paramUid ?? usuario?.uid;
  const nombreEjecutivo = nombreParam ?? usuarioSistema?.nombre ?? usuario?.displayName ?? "Ejecutivo";

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
      // Resolver nombre cuando el admin navega con ?uid=
      if (paramUid) {
        const ejDoc = await getDoc(doc(db, "usuarios", paramUid));
        if (ejDoc.exists()) {
          const d = ejDoc.data();
          setNombreParam((d.nombre as string) ?? (d.email as string) ?? paramUid);
        }
      }

      // 1. Conjuntos asignados a este ejecutivo
      const clientesSnap = await getDocs(
        query(
          collection(db, "clientes"),
          where("ejecutivoPrejuridicoId", "==", uid),
          where("activo", "==", true)
        )
      );

      const clienteIds = new Set(clientesSnap.docs.map((d) => d.id));
      const clienteNombres = new Map<string, string>();
      clientesSnap.docs.forEach((d) => {
        clienteNombres.set(d.id, (d.data().nombre as string) ?? d.id);
      });

      // 2. Todos los deudores → filtrar en memoria por los conjuntos del ejecutivo
      const deudoresSnap = await getDocs(collectionGroup(db, "deudores"));

      const EXCLUIR = new Set<string>([
        TipificacionDeuda.INACTIVO,
        TipificacionDeuda.TERMINADO,
        TipificacionDeuda.DEMANDA_TERMINADO,
        TipificacionDeuda.DEVUELTO,
      ]);

      const deuMap = new Map<string, number>();
      const acuMap = new Map<string, number>();
      const gestionando: DeudorGestionando[] = [];

      deudoresSnap.forEach((doc) => {
        const clienteId = doc.ref.parent.parent?.id;
        if (!clienteId || !clienteIds.has(clienteId)) return;

        const data = doc.data();
        if (EXCLUIR.has(data?.tipificacion)) return;

        deuMap.set(clienteId, (deuMap.get(clienteId) ?? 0) + 1);
        if (
          data?.tipificacion === TipificacionDeuda.ACUERDO ||
          data?.tipificacion === TipificacionDeuda.DEMANDA_ACUERDO
        ) {
          acuMap.set(clienteId, (acuMap.get(clienteId) ?? 0) + 1);
        }

        // Recolectar TODOS los GESTIONANDO con su tiempo sin seguimiento
        if (data?.tipificacion === TipificacionDeuda.GESTIONANDO) {
          const seg = data.fechaUltimoSeguimiento;
          const tieneFecha = seg && typeof seg.toDate === "function";
          const dias = tieneFecha
            ? Math.floor((Date.now() - seg.toDate().getTime()) / (1000 * 60 * 60 * 24))
            : 9999;
          gestionando.push({
            deudorId: doc.id,
            nombre: (data.nombre as string) ?? doc.id,
            clienteId,
            clienteNombre: clienteNombres.get(clienteId) ?? clienteId,
            diasSinGestion: dias,
          });
        }
      });

      // Ordenar: nunca gestionados primero (9999), luego mayor días primero
      gestionando.sort((a, b) => b.diasSinGestion - a.diasSinGestion);
      setTodosGestionando(gestionando);

      // 3. Armar filas ordenadas por deudores desc
      const result: FilaConjunto[] = clientesSnap.docs
        .map((doc) => {
          const id = doc.id;
          const totalDeudores = deuMap.get(id) ?? 0;
          const totalAcuerdos = acuMap.get(id) ?? 0;
          return {
            clienteId: id,
            clienteNombre: clienteNombres.get(id) ?? id,
            totalDeudores,
            totalAcuerdos,
            pctAcuerdos: pct(totalAcuerdos, totalDeudores),
          };
        })
        .sort((a, b) => b.totalDeudores - a.totalDeudores);

      setFilas(result);
    } catch (err) {
      console.error("Error cargando dashboard ejecutivo:", err);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Totales
  const totalConjuntos = filas.length;
  const totalDeudores = useMemo(
    () => filas.reduce((s, f) => s + f.totalDeudores, 0),
    [filas]
  );
  const totalAcuerdos = useMemo(
    () => filas.reduce((s, f) => s + f.totalAcuerdos, 0),
    [filas]
  );

  // KPI siempre muestra el umbral de 15 días (métrica crítica de referencia)
  const sinGestion15d = useMemo(
    () => todosGestionando.filter((d) => d.diasSinGestion >= 15).length,
    [todosGestionando]
  );

  // Panel filtra según el selector
  const sinGestionFiltrado = useMemo(() => {
    if (diasFiltro === "nunca") return todosGestionando.filter((d) => d.diasSinGestion === 9999);
    const umbral = Number(diasFiltro);
    return todosGestionando.filter((d) => d.diasSinGestion >= umbral);
  }, [todosGestionando, diasFiltro]);

  const labelFiltro = DIAS_OPCIONES.find((o) => o.value === diasFiltro)?.label ?? diasFiltro;

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
                Mi Dashboard
              </Typography>
              <Typography variant="body" className="text-muted-foreground capitalize">
                {currentDate}
              </Typography>
              <Typography variant="small" className="text-muted-foreground/70">
                {nombreEjecutivo}
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
        <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={<Building2 className="h-5 w-5 text-blue-600" />}
            iconBg="bg-blue-100"
            label="Conjuntos asignados"
            value={loading ? "…" : String(totalConjuntos)}
          />
          <KpiCard
            icon={<Users className="h-5 w-5 text-orange-600" />}
            iconBg="bg-orange-100"
            label="Deudores activos"
            value={loading ? "…" : String(totalDeudores)}
            subtitle="Excluye inactivos"
          />
          <KpiCard
            icon={<Handshake className="h-5 w-5 text-teal-600" />}
            iconBg="bg-teal-100"
            label="Deudores con acuerdo"
            value={loading ? "…" : String(totalAcuerdos)}
            valueColor="text-teal-700"
            subtitle={
              totalDeudores > 0
                ? `${pct(totalAcuerdos, totalDeudores)}% de deudores activos`
                : undefined
            }
          />
          <KpiCard
            icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            iconBg="bg-red-100"
            label="Gestionando sin seguimiento"
            value={loading ? "…" : String(sinGestion15d)}
            valueColor={sinGestion15d > 0 ? "text-red-600" : "text-muted-foreground"}
            subtitle="Sin gestión en los últimos 15 días"
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
              <TrendingUp className="h-5 w-5 text-brand-primary shrink-0" />
              <div className="text-left">
                <Typography variant="h3" className="!text-brand-secondary font-semibold">
                  Mis conjuntos
                </Typography>
                <Typography variant="small" className="text-muted-foreground">
                  {totalConjuntos} conjuntos activos · Deudores y acuerdos por conjunto
                </Typography>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 hidden sm:flex"
                onClick={(e) => { e.stopPropagation(); navigate("/clientes-tables"); }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver todos
              </Button>
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
                        Deudores
                      </th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                        Con Acuerdo
                      </th>
                      <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                        % Acuerdo
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
                        <td className="py-3 px-4 text-right tabular-nums font-medium">
                          {fila.totalDeudores}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-teal-700 font-medium">
                          {fila.totalAcuerdos}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <AcuerdoBadge value={fila.pctAcuerdos} />
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
                      <td className="py-3 px-4 text-right tabular-nums">
                        {totalDeudores}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-teal-700">
                        {totalAcuerdos}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <AcuerdoBadge value={pct(totalAcuerdos, totalDeudores)} />
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}
        </section>

        {/* ── DEUDORES SIN GESTIÓN ── */}
        <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            className="w-full bg-gradient-to-r from-red-50 to-orange-50 px-5 py-4 border-b flex items-center justify-between gap-2 hover:from-red-100/60 hover:to-orange-100/60 transition-colors"
            onClick={() => setShowSinGestion((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
              <div className="text-left">
                <Typography variant="h3" className="!text-red-700 font-semibold">
                  Gestionando sin seguimiento
                </Typography>
                <Typography variant="small" className="text-muted-foreground">
                  {loading
                    ? "Cargando…"
                    : sinGestionFiltrado.length === 0
                    ? "Todos los deudores están al día"
                    : `${sinGestionFiltrado.length} deudores · filtro: ${labelFiltro} · Los sin gestión previa aparecen primero`}
                </Typography>
              </div>
            </div>
            {showSinGestion
              ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
          </button>

          {showSinGestion && (
            <>
              {/* Barra de filtro */}
              <div className="px-5 py-3 border-b bg-slate-50 flex items-center gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Sin seguimiento en:
                </span>
                <Select value={diasFiltro} onValueChange={(v) => setDiasFiltro(v as DiasFiltro)}>
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIAS_OPCIONES.map((o) => (
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
                ) : sinGestionFiltrado.length === 0 ? (
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
                          Días sin gestión
                        </th>
                        <th className="py-3 px-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {sinGestionFiltrado.map((d) => (
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
                            {d.diasSinGestion === 9999 ? (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700">
                                Nunca
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700">
                                {d.diasSinGestion}d
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
