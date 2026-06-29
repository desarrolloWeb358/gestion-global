"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Wallet,
  BarChart3,
  Building2,
  ChevronUp,
  ChevronDown,
  Loader2,
  RefreshCw,
  ExternalLink,
  Handshake,
  UserCog,
} from "lucide-react";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";
import { db } from "@/firebase";
import {
  collection,
  collectionGroup,
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
import { Label } from "@/shared/ui/label";
import { obtenerResumenMesConNombres } from "@/modules/reportes/services/recaudoMensualService";
import {
  ResumenMesSeleccionado,
  ResumenPorCliente,
  TotalesMes,
} from "@/modules/reportes/models/recaudoMensual.model";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import type { Franquicia } from "@/modules/franquicias/models/franquicia.model";
import { obtenerFranquicias } from "@/modules/franquicias/services/franquiciaService";

// ─── Helpers ────────────────────────────────────────────────────────────────

const currency = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);

const pct = (num: number, den: number) =>
  den > 0 ? Math.round((num / den) * 100) : 0;

function currentYM() {
  const d = new Date();
  return {
    year: String(d.getFullYear()),
    month: String(d.getMonth() + 1).padStart(2, "0"),
  };
}

const MONTH_LABELS = [
  { v: "01", l: "Enero" },
  { v: "02", l: "Febrero" },
  { v: "03", l: "Marzo" },
  { v: "04", l: "Abril" },
  { v: "05", l: "Mayo" },
  { v: "06", l: "Junio" },
  { v: "07", l: "Julio" },
  { v: "08", l: "Agosto" },
  { v: "09", l: "Septiembre" },
  { v: "10", l: "Octubre" },
  { v: "11", l: "Noviembre" },
  { v: "12", l: "Diciembre" },
];

// ─── Types ───────────────────────────────────────────────────────────────────

type SortKey =
  | "clienteNombre"
  | "deudores"
  | "deuda"
  | "recaudo"
  | "recuperacion"
  | "honorario";
type SortDir = "asc" | "desc";
type SinGestionThreshold = "1m" | "2m" | "3m" | "sin_gestion";

interface FilaCliente extends ResumenPorCliente {
  deudores: number;
  recuperacion: number;
}

interface ClienteInfo {
  id: string;
  nombre: string;
  ejecutivoPrejuridicoId: string | null;
  ejecutivoDependienteId: string | null;
  franquiciaId?: string;
}

interface EjecutivoStat {
  ejecutivoId: string;
  ejecutivoNombre: string;
  totalConjuntos: number;
  totalDeudores: number;
  totalAcuerdosEnFirme: number;
  pctAcuerdos: number;
  sinGestion15d: number;
}

interface DependienteStat {
  dependienteId: string;
  dependienteNombre: string;
  totalConjuntos: number;
  totalDeudoresEnDemanda: number;
  sinGestion: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  small?: boolean;
  onClick?: () => void;
  valueColor?: string;
  subtitle?: string;
}

function KpiCard({
  icon,
  iconBg,
  label,
  value,
  small,
  onClick,
  valueColor,
  subtitle,
}: KpiCardProps) {
  return (
    <div
      className={`rounded-xl border bg-white p-5 shadow-sm transition-all ${
        onClick ? "cursor-pointer hover:shadow-md hover:border-brand-primary/30" : ""
      }`}
      onClick={onClick}
    >
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

function ThSortable({
  label,
  sortKey,
  current,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const isActive = current === sortKey;
  return (
    <th
      className={`py-3 px-4 text-${align} text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          dir === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : null}
      </span>
    </th>
  );
}

function RecupBadge({ value }: { value: number }) {
  const color =
    value >= 70
      ? "bg-green-100 text-green-700"
      : value >= 40
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}
    >
      {value}%
    </span>
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
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}
    >
      {value}%
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { can } = useAcl();
  const canView = can(PERMS.Admin_Read) || can(PERMS.Valores_Read);

  const { year: y, month: m } = currentYM();
  const [year, setYear] = useState(y);
  const [month, setMonth] = useState(m);
  const mesClave = `${year}-${month}`;

  // ── Filtro por franquicia (solo vista; reescala todo el panel)
  const FRANQ_ALL = "__ALL__";
  const [franquicias, setFranquicias] = useState<Franquicia[]>([]);
  const [franquiciaFiltro, setFranquiciaFiltro] = useState<string>(FRANQ_ALL);

  // ── Data
  const [clientesList, setClientesList] = useState<ClienteInfo[]>([]);
  const [deudoresPorCliente, setDeudoresPorCliente] = useState<Map<string, number>>(
    new Map()
  );
  const [resumen, setResumen] = useState<ResumenMesSeleccionado | null>(null);
  const [usuariosMap, setUsuariosMap] = useState<Map<string, string>>(new Map());
  const [excludedEjecutivoIds] = useState<Set<string>>(new Set());
  const [dependientesUsers, setDependientesUsers] = useState<Map<string, string>>(new Map());
  const [acuerdosEnFirmeMap, setAcuerdosEnFirmeMap] = useState<Map<string, number>>(
    new Map()
  );
  const [sinGestion15dMap, setSinGestion15dMap] = useState<Map<string, number>>(new Map());
  const [demandaCountMap, setDemandaCountMap] = useState<Map<string, number>>(new Map());
  const [demandaRevisionesMap, setDemandaRevisionesMap] = useState<Map<string, (Date | null)[]>>(new Map());

  // ── Loading
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingMes, setLoadingMes] = useState(false);

  // ── Sort (tabla conjuntos)
  const [sortKey, setSortKey] = useState<SortKey>("recaudo");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Secciones colapsables (cerradas por defecto para reducir carga inicial)
  const [ejecutivosExpanded, setEjecutivosExpanded] = useState(false);
  const [dependientesExpanded, setDependientesExpanded] = useState(false);
  const [conjuntosExpanded, setConjuntosExpanded] = useState(false);

  // ── Filtro sin gestión dependientes
  const [depSinGestionFilter, setDepSinGestionFilter] = useState<SinGestionThreshold>("1m");

  const years = useMemo(() => {
    const max = new Date().getFullYear();
    const arr: string[] = [];
    for (let a = 2020; a <= max; a++) arr.push(String(a));
    return arr.reverse();
  }, []);

  // ── Fetch KPIs globales
  useEffect(() => {
    async function fetchKpis() {
      try {
        const deudoresSnap = await getDocs(collectionGroup(db, "deudores"));

        const EXCLUIR = new Set<string>([
          TipificacionDeuda.INACTIVO,
          TipificacionDeuda.TERMINADO,
          TipificacionDeuda.DEMANDA_TERMINADO,
          TipificacionDeuda.DEVUELTO,
        ]);

        const hace15dias = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
        const deuMap = new Map<string, number>();
        const acuMap = new Map<string, number>();
        const sinGestMap = new Map<string, number>();
        const demandaCountMap = new Map<string, number>();
        const demandaRevisionesMap = new Map<string, (Date | null)[]>();

        const DEMANDA_TIPOS = new Set<string>([
          TipificacionDeuda.DEMANDA,
          TipificacionDeuda.DEMANDA_ACUERDO,
          TipificacionDeuda.DEMANDA_INSOLVENCIA,
        ]);

        deudoresSnap.forEach((doc) => {
          const data = doc.data();
          if (EXCLUIR.has(data?.tipificacion)) return;
          const clienteId = doc.ref.parent.parent?.id;
          if (clienteId) {
            deuMap.set(clienteId, (deuMap.get(clienteId) ?? 0) + 1);
            if (data?.tipificacion === TipificacionDeuda.ACUERDO || data?.tipificacion === TipificacionDeuda.DEMANDA_ACUERDO) {
              acuMap.set(clienteId, (acuMap.get(clienteId) ?? 0) + 1);
            }
            if (data?.tipificacion === TipificacionDeuda.GESTIONANDO) {
              const seg = data.fechaUltimoSeguimiento;
              const tieneReciente = seg && typeof seg.toDate === 'function' && seg.toDate() >= hace15dias;
              if (!tieneReciente) {
                sinGestMap.set(clienteId, (sinGestMap.get(clienteId) ?? 0) + 1);
              }
            }
            if (DEMANDA_TIPOS.has(data?.tipificacion)) {
              demandaCountMap.set(clienteId, (demandaCountMap.get(clienteId) ?? 0) + 1);
              const rev = data.fechaUltimaRevision;
              const revDate = rev && typeof rev.toDate === "function" ? (rev.toDate() as Date) : null;
              if (!demandaRevisionesMap.has(clienteId)) demandaRevisionesMap.set(clienteId, []);
              demandaRevisionesMap.get(clienteId)!.push(revDate);
            }
          }
        });

        const [clientesResult, usuariosResult] = await Promise.allSettled([
          getDocs(query(collection(db, "clientes"), where("activo", "==", true))),
          getDocs(collection(db, "usuarios")),
        ]);

        // 1. Resolver usuarios
        if (usuariosResult.status === "fulfilled") {
          const usersMap = new Map<string, string>();
          const depUsersMap = new Map<string, string>();
          usuariosResult.value.docs.forEach((doc) => {
            const data = doc.data();
            const nombre = (data.nombre as string) ?? (data.email as string) ?? doc.id;
            usersMap.set(doc.id, nombre);
            const roles = Array.isArray(data.roles) ? (data.roles as string[]) : [];
            if (roles.includes("dependiente") && data.activo !== false) {
              depUsersMap.set(doc.id, nombre);
            }
          });
          setUsuariosMap(usersMap);
          setDependientesUsers(depUsersMap);
        }

        // 2. Resolver clientes activos
        if (clientesResult.status === "fulfilled") {
          const filteredDocs = clientesResult.value.docs;
          setClientesList(
            filteredDocs.map((doc) => ({
              id: doc.id,
              nombre: (doc.data().nombre as string) ?? "",
              ejecutivoPrejuridicoId:
                (doc.data().ejecutivoPrejuridicoId as string) ?? null,
              ejecutivoDependienteId:
                (doc.data().ejecutivoDependienteId as string) ?? null,
              franquiciaId: (doc.data().franquiciaId as string) ?? undefined,
            }))
          );

          // Limpiar los mapas: conservar SOLO los clientes activos y no excluidos.
          // collectionGroup trae deudores de TODOS los clientes (activos e inactivos);
          // hay que descartar los que no pertenecen al conjunto válido.
          const validClienteIds = new Set(filteredDocs.map((d) => d.id));
          for (const id of [...deuMap.keys()]) {
            if (!validClienteIds.has(id)) deuMap.delete(id);
          }
          for (const id of [...acuMap.keys()]) {
            if (!validClienteIds.has(id)) acuMap.delete(id);
          }
          for (const id of [...sinGestMap.keys()]) {
            if (!validClienteIds.has(id)) sinGestMap.delete(id);
          }
          for (const id of [...demandaCountMap.keys()]) {
            if (!validClienteIds.has(id)) demandaCountMap.delete(id);
          }
          for (const id of [...demandaRevisionesMap.keys()]) {
            if (!validClienteIds.has(id)) demandaRevisionesMap.delete(id);
          }
        }

        // 3. Persistir mapas ya filtrados
        setDeudoresPorCliente(deuMap);
        setAcuerdosEnFirmeMap(acuMap);
        setSinGestion15dMap(sinGestMap);
        setDemandaCountMap(demandaCountMap);
        setDemandaRevisionesMap(demandaRevisionesMap);

      } catch (err) {
        console.error("Error cargando KPIs globales:", err);
      } finally {
        setLoadingKpis(false);
      }
    }
    fetchKpis();
  }, []);

  // ── Cargar franquicias para el filtro
  useEffect(() => {
    obtenerFranquicias().then(setFranquicias).catch(() => {});
  }, []);

  // ── Fetch resumen del mes seleccionado
  const fetchMes = useCallback(async () => {
    if (!canView) return;
    setLoadingMes(true);
    try {
      const res = await obtenerResumenMesConNombres(mesClave);
      setResumen(res);
    } catch (err) {
      console.error("Error obteniendo resumen del mes:", err);
      setResumen(null);
    } finally {
      setLoadingMes(false);
    }
  }, [canView, mesClave]);

  useEffect(() => {
    fetchMes();
  }, [fetchMes]);

  // ── Helpers de franquicia (solo vista; restringen el conjunto de clienteIds)
  const franquiciaPorCliente = useMemo(() => {
    const m = new Map<string, string | undefined>();
    clientesList.forEach((c) => m.set(c.id, c.franquiciaId));
    return m;
  }, [clientesList]);

  const enFranquicia = useCallback(
    (clienteId: string) =>
      franquiciaFiltro === FRANQ_ALL ||
      franquiciaPorCliente.get(clienteId) === franquiciaFiltro,
    [franquiciaFiltro, franquiciaPorCliente]
  );

  const clientesListView = useMemo(
    () =>
      franquiciaFiltro === FRANQ_ALL
        ? clientesList
        : clientesList.filter((c) => c.franquiciaId === franquiciaFiltro),
    [clientesList, franquiciaFiltro]
  );

  // ── Totales calculados (respetan el filtro de franquicia)
  const totalDeudores = useMemo(() => {
    let total = 0;
    deudoresPorCliente.forEach((v, id) => { if (enFranquicia(id)) total += v; });
    return total;
  }, [deudoresPorCliente, enFranquicia]);

  const totalAcuerdosEnFirme = useMemo(() => {
    let total = 0;
    acuerdosEnFirmeMap.forEach((v, id) => { if (enFranquicia(id)) total += v; });
    return total;
  }, [acuerdosEnFirmeMap, enFranquicia]);

  // ── Tabla conjuntos: combinar resumen + conteo deudores (filtrado por franquicia)
  const filas = useMemo<FilaCliente[]>(() => {
    if (!resumen) return [];
    return resumen.porCliente
      .filter((r) => enFranquicia(r.clienteUID))
      .map((r) => ({
        ...r,
        deudores: deudoresPorCliente.get(r.clienteUID) ?? 0,
        recuperacion: pct(r.recaudo, r.deuda),
      }));
  }, [resumen, deudoresPorCliente, enFranquicia]);

  // Cartera/recaudo: consolidado cuando es "Todas"; si no, suma de las filas filtradas
  const totales = useMemo<TotalesMes | null>(() => {
    if (franquiciaFiltro === FRANQ_ALL) return resumen?.totales ?? null;
    if (!resumen) return null;
    const totalDeuda = filas.reduce((s, f) => s + (f.deuda ?? 0), 0);
    const totalRecaudo = filas.reduce((s, f) => s + (f.recaudo ?? 0), 0);
    const totalHonorario = filas.reduce((s, f) => s + (f.honorario ?? 0), 0);
    return { mes: resumen.totales.mes, totalDeuda, totalHonorario, totalRecaudo };
  }, [resumen, filas, franquiciaFiltro]);

  const pctRecuperacion = pct(totales?.totalRecaudo ?? 0, totales?.totalDeuda ?? 0);

  const filasOrdenadas = useMemo(() => {
    return [...filas].sort((a, b) => {
      if (sortKey === "clienteNombre") {
        const av = a.clienteNombre.toLowerCase();
        const bv = b.clienteNombre.toLowerCase();
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const av = Number(a[sortKey as keyof FilaCliente] ?? 0);
      const bv = Number(b[sortKey as keyof FilaCliente] ?? 0);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [filas, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // ── Ejecutivos prejurídico: agrupar conjuntos y deudores
  const ejecutivoStats = useMemo<EjecutivoStat[]>(() => {
    const map = new Map<string, EjecutivoStat>();
    const sinEjecutivo: EjecutivoStat = {
      ejecutivoId: "__sin_ejecutivo__",
      ejecutivoNombre: "— Sin ejecutivo asignado —",
      totalConjuntos: 0,
      totalDeudores: 0,
      totalAcuerdosEnFirme: 0,
      pctAcuerdos: 0,
      sinGestion15d: 0,
    };

    for (const cliente of clientesListView) {
      const ejId = cliente.ejecutivoPrejuridicoId;

      if (!ejId || excludedEjecutivoIds.has(ejId)) {
        sinEjecutivo.totalConjuntos++;
        sinEjecutivo.totalDeudores += deudoresPorCliente.get(cliente.id) ?? 0;
        sinEjecutivo.totalAcuerdosEnFirme += acuerdosEnFirmeMap.get(cliente.id) ?? 0;
        sinEjecutivo.sinGestion15d += sinGestion15dMap.get(cliente.id) ?? 0;
        continue;
      }

      if (!map.has(ejId)) {
        map.set(ejId, {
          ejecutivoId: ejId,
          ejecutivoNombre: usuariosMap.get(ejId) ?? "Sin nombre",
          totalConjuntos: 0,
          totalDeudores: 0,
          totalAcuerdosEnFirme: 0,
          pctAcuerdos: 0,
          sinGestion15d: 0,
        });
      }

      const ej = map.get(ejId)!;
      ej.totalConjuntos++;
      ej.totalDeudores += deudoresPorCliente.get(cliente.id) ?? 0;
      ej.totalAcuerdosEnFirme += acuerdosEnFirmeMap.get(cliente.id) ?? 0;
      ej.sinGestion15d += sinGestion15dMap.get(cliente.id) ?? 0;
    }

    const resultado = Array.from(map.values())
      .map((ej) => ({
        ...ej,
        pctAcuerdos: pct(ej.totalAcuerdosEnFirme, ej.totalDeudores),
      }))
      .sort((a, b) => b.totalDeudores - a.totalDeudores);

    if (sinEjecutivo.totalConjuntos > 0) {
      sinEjecutivo.pctAcuerdos = pct(sinEjecutivo.totalAcuerdosEnFirme, sinEjecutivo.totalDeudores);
      resultado.push(sinEjecutivo);
    }

    return resultado;
  }, [clientesListView, usuariosMap, deudoresPorCliente, acuerdosEnFirmeMap, excludedEjecutivoIds, sinGestion15dMap]);

  // ── Sin gestión dependientes: recalcula según el filtro seleccionado
  const sinGestionDemandaMap = useMemo(() => {
    const now = Date.now();
    const msMap: Record<SinGestionThreshold, number | null> = {
      "1m": 30 * 24 * 60 * 60 * 1000,
      "2m": 60 * 24 * 60 * 60 * 1000,
      "3m": 90 * 24 * 60 * 60 * 1000,
      "sin_gestion": null,
    };
    const limitMs = msMap[depSinGestionFilter];
    const result = new Map<string, number>();
    demandaRevisionesMap.forEach((fechas, clienteId) => {
      const count = fechas.filter((f) => {
        if (limitMs === null) return f === null;
        return f === null || now - f.getTime() > limitMs;
      }).length;
      if (count > 0) result.set(clienteId, count);
    });
    return result;
  }, [demandaRevisionesMap, depSinGestionFilter]);

  // ── Dependientes: agrupa conjuntos y deudores en demanda por ejecutivoDependienteId
  const dependienteStats = useMemo<DependienteStat[]>(() => {
    // Pre-seed con TODOS los usuarios activos con rol "dependiente"
    const map = new Map<string, DependienteStat>();
    for (const [id, nombre] of dependientesUsers) {
      map.set(id, {
        dependienteId: id,
        dependienteNombre: nombre,
        totalConjuntos: 0,
        totalDeudoresEnDemanda: 0,
        sinGestion: 0,
      });
    }

    const sinDependiente: DependienteStat = {
      dependienteId: "__sin_dependiente__",
      dependienteNombre: "— Sin dependiente asignado —",
      totalConjuntos: 0,
      totalDeudoresEnDemanda: 0,
      sinGestion: 0,
    };

    for (const cliente of clientesListView) {
      const depId = cliente.ejecutivoDependienteId;
      const deudoresDemanda = demandaCountMap.get(cliente.id) ?? 0;
      const sinGest = sinGestionDemandaMap.get(cliente.id) ?? 0;

      if (!depId || !map.has(depId)) {
        // Sin depId o depId no corresponde a un dependiente activo → sin asignar
        sinDependiente.totalConjuntos++;
        sinDependiente.totalDeudoresEnDemanda += deudoresDemanda;
        sinDependiente.sinGestion += sinGest;
        continue;
      }

      const dep = map.get(depId)!;
      dep.totalConjuntos++;
      dep.totalDeudoresEnDemanda += deudoresDemanda;
      dep.sinGestion += sinGest;
    }

    const resultado = Array.from(map.values()).sort(
      (a, b) => b.totalDeudoresEnDemanda - a.totalDeudoresEnDemanda
    );

    if (sinDependiente.totalConjuntos > 0) {
      resultado.push(sinDependiente);
    }

    return resultado;
  }, [clientesListView, usuariosMap, demandaCountMap, sinGestionDemandaMap, dependientesUsers]);

  const mesLabel = MONTH_LABELS.find((mm) => mm.v === month)?.l ?? month;

  const currentDate = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">

        {/* ── HEADER ── */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary shadow-lg">
              <LayoutDashboard className="h-7 w-7 text-white" />
            </div>
            <div>
              <Typography variant="h1" className="!text-brand-primary font-bold">
                Panel Gerencial
              </Typography>
              <Typography variant="body" className="text-muted-foreground capitalize">
                {currentDate}
              </Typography>
            </div>
          </div>

          {/* Filtro global año-mes */}
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <Label className="text-xs text-muted-foreground block mb-1">Año</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((yy) => (
                    <SelectItem key={yy} value={yy}>
                      {yy}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground block mb-1">Mes</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_LABELS.map((mm) => (
                    <SelectItem key={mm.v} value={mm.v}>
                      {mm.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground block mb-1">Franquicia</Label>
              <Select value={franquiciaFiltro} onValueChange={setFranquiciaFiltro}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FRANQ_ALL}>Todas</SelectItem>
                  {franquicias.map((f) => (
                    <SelectItem key={f.id} value={f.id!}>
                      {f.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={fetchMes}
              disabled={loadingMes}
              className="gap-2"
            >
              {loadingMes ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Consultar
            </Button>
          </div>
        </header>

        {/* ── KPI FILA 1: conteos ── */}
        <section className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <KpiCard
            icon={<Building2 className="h-5 w-5 text-blue-600" />}
            iconBg="bg-blue-100"
            label="Conjuntos activos"
            value={loadingKpis ? "…" : String(clientesListView.length)}
            onClick={() => navigate("/clientes-tables")}
            subtitle="Ver todos →"
          />
          <KpiCard
            icon={<Users className="h-5 w-5 text-orange-600" />}
            iconBg="bg-orange-100"
            label="Deudores activos"
            value={loadingKpis ? "…" : String(totalDeudores)}
            subtitle="Excluye inactivos"
          />
          <KpiCard
            icon={<Handshake className="h-5 w-5 text-teal-600" />}
            iconBg="bg-teal-100"
            label="Deudores con acuerdo activo"
            value={loadingKpis ? "…" : String(totalAcuerdosEnFirme)}
            valueColor="text-teal-700"
            subtitle={
              totalDeudores > 0
                ? `${pct(totalAcuerdosEnFirme, totalDeudores)}% de deudores activos`
                : undefined
            }
          />
        </section>

        {/* ── KPI FILA 2: valores del mes ── */}
        <section className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <KpiCard
            icon={<Wallet className="h-5 w-5 text-amber-600" />}
            iconBg="bg-amber-100"
            label={`Cartera ${mesLabel} ${year}`}
            value={loadingMes ? "…" : currency(totales?.totalDeuda ?? 0)}
            small
            valueColor="text-amber-700"
          />
          <KpiCard
            icon={<TrendingUp className="h-5 w-5 text-green-600" />}
            iconBg="bg-green-100"
            label={`Recaudo ${mesLabel} ${year}`}
            value={loadingMes ? "…" : currency(totales?.totalRecaudo ?? 0)}
            small
            valueColor="text-green-700"
          />
        </section>

        {/* ── TABLA POR EJECUTIVO PREJURÍDICO ── */}
        <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <button
            className="w-full text-left bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 px-5 py-4 border-b hover:bg-slate-50 transition-colors"
            onClick={() => setEjecutivosExpanded((v) => !v)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCog className="h-5 w-5 text-brand-primary" />
                <Typography variant="h3" className="!text-brand-secondary font-semibold">
                  Reporte por Ejecutivo Prejurídico
                </Typography>
              </div>
              {ejecutivosExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
            </div>
            <Typography variant="small" className="text-muted-foreground">
              {ejecutivosExpanded
                ? "Conjuntos y deudores asignados · Acuerdos · Gestionando sin seguimiento en +15 días"
                : loadingKpis
                ? "Cargando datos…"
                : `${ejecutivoStats.filter((e) => e.ejecutivoId !== "__sin_ejecutivo__").length} ejecutivos · Clic para ver detalle`}
            </Typography>
          </button>

          {ejecutivosExpanded && (
          <div className="overflow-x-auto">
            {loadingKpis ? (
              <div className="h-48 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : ejecutivoStats.length === 0 ? (
              <div className="h-48 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Sin ejecutivos prejurídicos asignados.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Ejecutivo
                    </th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      Conjuntos
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
                    <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      Sin gest. +15d
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ejecutivoStats.map((ej) => {
                    const esSinEjecutivo = ej.ejecutivoId === "__sin_ejecutivo__";
                    return (
                      <tr
                        key={ej.ejecutivoId}
                        onClick={
                          !esSinEjecutivo
                            ? () => navigate(`/dashboard/ejecutivo?uid=${ej.ejecutivoId}`)
                            : undefined
                        }
                        className={`border-t transition-colors ${
                          esSinEjecutivo
                            ? "bg-slate-50/50"
                            : "hover:bg-slate-50/70 cursor-pointer"
                        }`}
                      >
                        <td
                          className={`py-3 px-4 ${
                            esSinEjecutivo
                              ? "text-muted-foreground italic text-xs"
                              : "font-medium text-brand-primary hover:underline"
                          }`}
                        >
                          {ej.ejecutivoNombre}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                          {ej.totalConjuntos}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-medium">
                          {ej.totalDeudores}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-teal-700 font-medium">
                          {ej.totalAcuerdosEnFirme}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <AcuerdoBadge value={ej.pctAcuerdos} />
                        </td>
                        <td className="py-3 px-4 text-right">
                          {ej.sinGestion15d > 0 ? (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700">
                              {ej.sinGestion15d}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr className="font-semibold">
                    <td className="py-3 px-4 text-sm">
                      Totales ({ejecutivoStats.filter(e => e.ejecutivoId !== "__sin_ejecutivo__").length} ejecutivos)
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                      {ejecutivoStats.reduce((s, e) => s + e.totalConjuntos, 0)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      {totalDeudores}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-teal-700">
                      {totalAcuerdosEnFirme}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <AcuerdoBadge value={pct(totalAcuerdosEnFirme, totalDeudores)} />
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-red-700 font-semibold">
                      {ejecutivoStats.reduce((s, e) => s + e.sinGestion15d, 0) || "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
          )}
        </section>

        {/* ── TABLA POR DEPENDIENTE ── */}
        <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <button
            className="w-full text-left bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 px-5 py-4 border-b hover:bg-slate-50 transition-colors"
            onClick={() => setDependientesExpanded((v) => !v)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCog className="h-5 w-5 text-brand-primary" />
                <Typography variant="h3" className="!text-brand-secondary font-semibold">
                  Reporte por Dependiente
                </Typography>
              </div>
              {dependientesExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
            </div>
            <Typography variant="small" className="text-muted-foreground">
              {dependientesExpanded
                ? "Deudores en demanda asignados · Sin revisión según umbral seleccionado"
                : loadingKpis
                ? "Cargando datos…"
                : `${dependienteStats.filter((d) => d.dependienteId !== "__sin_dependiente__").length} dependientes · Clic para ver detalle`}
            </Typography>
          </button>

          {dependientesExpanded && (
            <div>
              {/* Selector de umbral sin gestión */}
              <div className="px-5 py-3 border-b bg-slate-50/60 flex items-center gap-3 flex-wrap">
                <span className="text-xs text-muted-foreground font-medium">Sin seguimiento en:</span>
                {(
                  [
                    { v: "1m", l: "1 mes" },
                    { v: "2m", l: "2 meses" },
                    { v: "3m", l: "3 meses" },
                    { v: "sin_gestion", l: "Sin gestión" },
                  ] as { v: SinGestionThreshold; l: string }[]
                ).map(({ v, l }) => (
                  <button
                    key={v}
                    onClick={() => setDepSinGestionFilter(v)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      depSinGestionFilter === v
                        ? "bg-brand-primary text-white"
                        : "bg-white border text-muted-foreground hover:border-brand-primary/50"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto">
                {loadingKpis ? (
                  <div className="h-48 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : dependienteStats.length === 0 ? (
                  <div className="h-48 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                      Sin dependientes asignados o sin deudores en demanda.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Dependiente
                        </th>
                        <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                          Conjuntos
                        </th>
                        <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                          Deudores en demanda
                        </th>
                        <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                          {depSinGestionFilter === "1m"
                            ? "Sin rev. > 1 mes"
                            : depSinGestionFilter === "2m"
                            ? "Sin rev. > 2 meses"
                            : depSinGestionFilter === "3m"
                            ? "Sin rev. > 3 meses"
                            : "Sin gestión"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dependienteStats.map((dep) => {
                        const esSinDep = dep.dependienteId === "__sin_dependiente__";
                        return (
                          <tr
                            key={dep.dependienteId}
                            onClick={() => navigate(`/dashboard/dependiente?uid=${dep.dependienteId}`)}
                            className={`border-t transition-colors hover:bg-slate-50/70 cursor-pointer ${
                              esSinDep ? "bg-slate-50/50" : ""
                            }`}
                          >
                            <td
                              className={`py-3 px-4 ${
                                esSinDep
                                  ? "text-muted-foreground italic text-xs"
                                  : "font-medium text-brand-primary hover:underline"
                              }`}
                            >
                              {dep.dependienteNombre}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                              {dep.totalConjuntos}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums font-medium">
                              {dep.totalDeudoresEnDemanda}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {dep.sinGestion > 0 ? (
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700">
                                  {dep.sinGestion}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                      <tr className="font-semibold">
                        <td className="py-3 px-4 text-sm">
                          Totales ({dependienteStats.filter((d) => d.dependienteId !== "__sin_dependiente__").length} dependientes)
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {dependienteStats.reduce((s, d) => s + d.totalConjuntos, 0)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {dependienteStats.reduce((s, d) => s + d.totalDeudoresEnDemanda, 0)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-red-700 font-semibold">
                          {dependienteStats.reduce((s, d) => s + d.sinGestion, 0) || "—"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── TABLA POR CLIENTE ── */}
        <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <button
              className="flex-1 text-left flex items-center justify-between gap-2 hover:opacity-80 transition-opacity"
              onClick={() => setConjuntosExpanded((v) => !v)}
            >
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-brand-primary" />
                  <Typography variant="h3" className="!text-brand-secondary font-semibold">
                    Cartera global por conjunto — {mesLabel} {year}
                  </Typography>
                </div>
                <Typography variant="small" className="text-muted-foreground">
                  {conjuntosExpanded
                    ? `${filasOrdenadas.length} conjuntos con movimiento · Clic en columna para ordenar`
                    : loadingMes
                    ? "Cargando datos…"
                    : `${filasOrdenadas.length > 0 ? `${filasOrdenadas.length} conjuntos` : "Sin datos para este mes"} · Clic para ver detalle`}
                </Typography>
              </div>
              {conjuntosExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
            </button>
           
          </div>

          {conjuntosExpanded && (
          <div className="overflow-x-auto">
            {loadingMes ? (
              <div className="h-48 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filasOrdenadas.length === 0 ? (
              <div className="h-48 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Sin datos de estados mensuales para {mesClave}.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <ThSortable
                      label="Conjunto"
                      sortKey="clienteNombre"
                      current={sortKey}
                      dir={sortDir}
                      onSort={handleSort}
                    />
                    <ThSortable
                      label="Deudores"
                      sortKey="deudores"
                      current={sortKey}
                      dir={sortDir}
                      onSort={handleSort}
                      align="right"
                    />
                    <ThSortable
                      label="Cartera"
                      sortKey="deuda"
                      current={sortKey}
                      dir={sortDir}
                      onSort={handleSort}
                      align="right"
                    />
                    <ThSortable
                      label="Recaudado"
                      sortKey="recaudo"
                      current={sortKey}
                      dir={sortDir}
                      onSort={handleSort}
                      align="right"
                    />
                    <ThSortable
                      label="% Recup."
                      sortKey="recuperacion"
                      current={sortKey}
                      dir={sortDir}
                      onSort={handleSort}
                      align="right"
                    />
                    <ThSortable
                      label="Honorarios"
                      sortKey="honorario"
                      current={sortKey}
                      dir={sortDir}
                      onSort={handleSort}
                      align="right"
                    />
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {filasOrdenadas.map((fila) => (
                    <tr
                      key={fila.clienteUID}
                      className="border-t hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium max-w-[200px] truncate">
                        {fila.clienteNombre}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                        {fila.deudores}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-amber-700 font-medium">
                        {currency(fila.deuda)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-green-700 font-medium">
                        {currency(fila.recaudo)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <RecupBadge value={fila.recuperacion} />
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-indigo-700">
                        {currency(fila.honorario)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => navigate(`/clientes/${fila.clienteUID}`)}
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
                      Totales ({filasOrdenadas.length} conjuntos)
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-muted-foreground">
                      {totalDeudores}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-amber-700">
                      {currency(totales?.totalDeuda ?? 0)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-green-700">
                      {currency(totales?.totalRecaudo ?? 0)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <RecupBadge value={pctRecuperacion} />
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-indigo-700">
                      {currency(totales?.totalHonorario ?? 0)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
          )}
        </section>

      </div>
    </div>
  );
}
