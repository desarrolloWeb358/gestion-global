// modules/cobranza/components/reportes/ReporteDemandasPage.tsx
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  Gavel,
  Search,
  Download,
  Filter as FilterIcon,
  Tag,
  ExternalLink,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/shared/ui/select";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/shared/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/shared/ui/dropdown-menu";
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import type { Rol } from "@/shared/constants/acl";
import {
  buscarDemandas,
  completarTipificaciones,
  cargarOpcionesFiltroDemandas,
  type DemandaReporteRow,
  type DemandaReporteFiltros,
} from "../../services/reportes/demandaReporteGlobalService";
import { getEtiquetasDemanda } from "../../services/etiquetaDemandaService";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";

const TIPIFICACIONES = Object.values(TipificacionDeuda);

const fmt = new Intl.DateTimeFormat("es-CO", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const fmtD = (d: Date | null) => (d ? fmt.format(d) : "—");

/** Persistencia de la última consulta (filtros + resultados) al salir y volver. */
const SESSION_KEY = "reporteDemandas:ultimaConsulta";

type ConsultaGuardada = {
  fDependiente: string;
  fEtiqueta: string;
  fTipificaciones: TipificacionDeuda[];
  rows: DemandaReporteRow[];
  /** true si no cupieron los resultados: se conservan solo los filtros. */
  truncada?: boolean;
};

const aFecha = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
};

function guardarConsulta(
  fDependiente: string,
  fEtiqueta: string,
  fTipificaciones: TipificacionDeuda[],
  rows: DemandaReporteRow[]
) {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ fDependiente, fEtiqueta, fTipificaciones, rows })
    );
  } catch {
    // Cuota llena (resultados muy grandes): al menos conservamos los filtros.
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ fDependiente, fEtiqueta, fTipificaciones, rows: [], truncada: true })
      );
    } catch {
      /* almacenamiento no disponible: la persistencia es opcional */
    }
  }
}

/** JSON.parse devuelve las fechas como string: hay que revivirlas. */
function leerConsultaGuardada(): ConsultaGuardada | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ConsultaGuardada;
    if (!p || !Array.isArray(p.rows)) return null;
    return {
      fDependiente: p.fDependiente ?? "",
      fEtiqueta: p.fEtiqueta ?? "todas",
      fTipificaciones: Array.isArray(p.fTipificaciones) ? p.fTipificaciones : [],
      truncada: !!p.truncada,
      rows: p.rows.map((r) => ({
        ...r,
        etiquetas: (r.etiquetas ?? []).map((e) => ({ ...e, fecha: aFecha(e.fecha) })),
        proximaAccionFecha: aFecha(r.proximaAccionFecha),
        fechaUltimaRevision: aFecha(r.fechaUltimaRevision),
        fechaCreacion: aFecha(r.fechaCreacion),
      })),
    };
  } catch {
    return null;
  }
}

export default function ReporteDemandasPage() {
  const navigate = useNavigate();
  const acl = useAcl() as { roles: Rol[] };
  const roles = Array.isArray(acl.roles) ? acl.roles : [];
  const uid = getAuth().currentUser?.uid ?? null;

  const esGlobal =
    roles.includes("admin") ||
    roles.includes("supervisor") ||
    roles.includes("ejecutivoAdmin");
  const soloDependiente = !esGlobal && roles.includes("dependiente");

  // Opciones de filtro (cargadas al entrar, SIN leer demandas)
  const [dependientesOpts, setDependientesOpts] = React.useState<{ id: string; nombre: string }[]>([]);
  const [etiquetasOpts, setEtiquetasOpts] = React.useState<string[]>([]);
  const [cargandoOpciones, setCargandoOpciones] = React.useState(true);

  // Última consulta guardada (para volver desde el detalle sin perder los filtros)
  const guardada = React.useMemo(() => leerConsultaGuardada(), []);

  // Resultados (solo tras presionar Buscar)
  const [rows, setRows] = React.useState<DemandaReporteRow[]>(guardada?.rows ?? []);
  const [buscando, setBuscando] = React.useState(false);
  const [exportando, setExportando] = React.useState(false);
  const [buscado, setBuscado] = React.useState(!!guardada && !guardada.truncada);

  // Estado de filtros
  const [fDependiente, setFDependiente] = React.useState<string>(guardada?.fDependiente ?? "");
  const [fEtiqueta, setFEtiqueta] = React.useState<string>(guardada?.fEtiqueta ?? "todas");
  const [fTipificaciones, setFTipificaciones] = React.useState<TipificacionDeuda[]>(
    guardada?.fTipificaciones ?? []
  );

  const alternarTipificacion = (t: TipificacionDeuda) => {
    setFTipificaciones((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  // Etiqueta del botón: "Todas" cuando no hay ninguna marcada.
  const resumenTipificaciones =
    fTipificaciones.length === 0
      ? "Todas"
      : fTipificaciones.length === 1
        ? fTipificaciones[0]
        : `${fTipificaciones.length} seleccionadas`;

  React.useEffect(() => {
    (async () => {
      try {
        setCargandoOpciones(true);
        const [op, etis] = await Promise.all([
          cargarOpcionesFiltroDemandas(),
          getEtiquetasDemanda(true),
        ]);
        setDependientesOpts(op.dependientes);
        setEtiquetasOpts(etis.map((e) => e.nombre).filter(Boolean));
        // Si es un dependiente solo, establecer su dependiente automáticamente
        if (soloDependiente && uid && !guardada) {
          setFDependiente(uid);
        }
      } catch {
        toast.error("⚠️ No se pudieron cargar los filtros");
      } finally {
        setCargandoOpciones(false);
      }
    })();
  }, []);

  // Obtener el nombre del dependiente seleccionado
  const nombreDependienteSeleccionado = dependientesOpts.find((d) => d.id === fDependiente)?.nombre ?? "";

  // Dependiente es obligatorio para buscar
  const hayFiltro = !!fDependiente;

  // Acotable al servidor por cliente/dependiente (búsqueda liviana).
  const busquedaAcotada = !!fDependiente;

  const buscar = async () => {
    if (!hayFiltro) {
      toast.error("Debes seleccionar un dependiente para buscar.");
      return;
    }
    const filtros: DemandaReporteFiltros = {
      clienteId: undefined,
      ejecutivoDependienteId: fDependiente || undefined,
      estado: undefined,
      etiquetaNombre: fEtiqueta !== "todas" ? fEtiqueta : undefined,
      tipificaciones: fTipificaciones.length > 0 ? fTipificaciones : undefined,
      soloSinCoteje: false,
      campoFecha: "proximaAccionFecha",
      desde: undefined,
      hasta: undefined,
    };
    try {
      setBuscando(true);
      const res = await buscarDemandas(filtros);
      setRows(res);
      setBuscado(true);
      guardarConsulta(fDependiente, fEtiqueta, fTipificaciones, res);
    } catch {
      toast.error("⚠️ No se pudo cargar el reporte de demandas");
    } finally {
      setBuscando(false);
    }
  };

  const resetFiltros = () => {
    if (soloDependiente && uid) {
      setFDependiente(uid);
    } else {
      setFDependiente("");
    }
    setFEtiqueta("todas");
    setFTipificaciones([]);
    setRows([]);
    setBuscado(false);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* almacenamiento no disponible */
    }
  };

  const abrirDemanda = (r: DemandaReporteRow) => {
    navigate(`/clientes/${r.clienteId}/deudores/${r.deudorId}/demandas/${r.demandaId}`);
  };

  const exportar = async () => {
    if (rows.length === 0) {
      toast.error("No hay filas para exportar.");
      return;
    }

    // La tipificación vive en el deudor: si la búsqueda no la trajo (filtro en
    // "Todas"), se leen aquí solo los deudores del resultado y se guardan en las
    // filas, para que una segunda exportación no vuelva a pagarlas.
    let filas = rows;
    try {
      setExportando(true);
      filas = await completarTipificaciones(rows);
      if (filas !== rows) {
        setRows(filas);
        guardarConsulta(fDependiente, fEtiqueta, fTipificaciones, filas);
      }
    } catch {
      toast.error("⚠️ No se pudo leer la tipificación; se exporta sin esa columna.");
    } finally {
      setExportando(false);
    }

    const data = filas.map((r) => ({
      Cliente: r.clienteNombre,
      Deudor: r.deudorNombre,
      Tipificación: r.tipificacion || "—",
      Radicado: r.numeroRadicado,
      Juzgado: r.juzgado,
      Etiquetas: r.etiquetas.map((e) => e.nombre).join(", "),
      Estado: r.estado,
      "Notif. sin coteje": r.notificacionesSinCoteje,
      "Próxima acción": r.proximaAccionFecha ? fmt.format(r.proximaAccionFecha) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 25 }, { wch: 22 },
      { wch: 28 }, { wch: 12 }, { wch: 15 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Demandas");
    XLSX.writeFile(wb, `Reporte_Demandas_${nombreDependienteSeleccionado}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <Gavel className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <Typography variant="h1" className="!text-brand-primary font-bold">
                Reporte de demandas
              </Typography>
              <Typography variant="small">
                {buscado
                  ? `${rows.length} demanda(s)`
                  : "Selecciona filtros y presiona Buscar"}
                {soloDependiente && " · tus conjuntos asignados"}
              </Typography>
            </div>
          </div>
          {buscado && rows.length > 0 && (
            <Button variant="brand" onClick={exportar} disabled={exportando} className="gap-2">
              <Download className={cn("h-4 w-4", exportando && "animate-pulse")} />
              {exportando ? "Preparando..." : "Exportar Excel"}
            </Button>
          )}
        </header>

        {/* Filtros */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FilterIcon className="h-5 w-5 text-brand-primary" />
              <Typography variant="h3" className="!text-brand-secondary font-semibold">Filtros</Typography>
            </div>
            <Button variant="ghost" size="sm" onClick={resetFiltros}>Limpiar</Button>
          </div>
          <div className="p-4 md:p-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dependiente</Label>
              <Select value={fDependiente} onValueChange={setFDependiente} disabled={cargandoOpciones}>
                <SelectTrigger className="border-brand-secondary/30"><SelectValue placeholder="Selecciona un dependiente" /></SelectTrigger>
                <SelectContent>
                  {dependientesOpts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Etiqueta</Label>
              <Select value={fEtiqueta} onValueChange={setFEtiqueta} disabled={cargandoOpciones}>
                <SelectTrigger className="border-brand-secondary/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {etiquetasOpts.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tipificación</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={cargandoOpciones}>
                  <Button
                    variant="outline"
                    className="w-full justify-between border-brand-secondary/30 font-normal"
                  >
                    <span className="truncate">{resumenTipificaciones}</span>
                    <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
                  {TIPIFICACIONES.map((t) => (
                    <DropdownMenuCheckboxItem
                      key={t}
                      checked={fTipificaciones.includes(t)}
                      onCheckedChange={() => alternarTipificacion(t)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {t}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {fTipificaciones.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setFTipificaciones([])}>
                        Quitar selección
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="px-4 md:px-5 pb-4 md:pb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {busquedaAcotada
                ? "Búsqueda acotada por cliente/dependiente (rápida)."
                : "Sugerencia: filtra por cliente o dependiente para una consulta más rápida."}
              {fTipificaciones.length > 0 &&
                " La tipificación se cruza contra los deudores del dependiente."}
            </p>
            <Button
              variant="brand"
              onClick={buscar}
              disabled={buscando || cargandoOpciones || !hayFiltro}
              className="gap-2"
            >
              <Search className={cn("h-4 w-4", buscando && "animate-pulse")} />
              {buscando ? "Buscando..." : "Buscar"}
            </Button>
          </div>
        </section>

        {/* Resultados */}
        {!buscado ? (
          <div className="rounded-2xl border border-dashed border-brand-secondary/30 bg-white p-12 text-center text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              Selecciona uno o más filtros y presiona <strong>Buscar</strong> para ver las demandas.
            </p>
          </div>
        ) : buscando ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
            <div className="h-12 w-12 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm text-muted-foreground">
            No hay demandas que cumplan los filtros.
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
              <Typography variant="h3" className="!text-brand-secondary font-semibold">
                Demandas de {nombreDependienteSeleccionado}
              </Typography>
            </div>
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="w-[22%] text-brand-secondary font-semibold">Cliente</TableHead>
                    <TableHead className="w-[22%] text-brand-secondary font-semibold">Deudor</TableHead>
                    <TableHead className="w-[16%] text-brand-secondary font-semibold">Radicado</TableHead>
                    <TableHead className="w-[18%] text-brand-secondary font-semibold">Juzgado</TableHead>
                    <TableHead className="w-[16%] text-brand-secondary font-semibold">Etiquetas</TableHead>
                    <TableHead className="w-[6%] text-center text-brand-secondary font-semibold">Ir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, index) => (
                    <TableRow
                      key={`${r.clienteId}-${r.deudorId}-${r.demandaId}`}
                      onClick={() => abrirDemanda(r)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          abrirDemanda(r);
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      title="Abrir demanda"
                      className={cn("border-brand-secondary/5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40", index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]", "hover:bg-brand-primary/5")}
                    >
                      <TableCell className="text-gray-700 w-[22%] truncate">{r.clienteNombre}</TableCell>
                      <TableCell className="font-medium text-gray-800 w-[22%] truncate">{r.deudorNombre || "—"}</TableCell>
                      <TableCell className="text-gray-700 font-mono text-xs w-[16%]">{r.numeroRadicado || "—"}</TableCell>
                      <TableCell className="text-gray-700 w-[18%] truncate">{r.juzgado || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.etiquetas.length === 0 ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : (
                            r.etiquetas.slice(0, 3).map((e, i) => (
                              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 text-xs">
                                <Tag className="h-3 w-3" />{e.nombre}
                              </span>
                            ))
                          )}
                          {r.etiquetas.length > 3 && <span className="text-xs text-muted-foreground">+{r.etiquetas.length - 3}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); abrirDemanda(r); }} className="hover:bg-brand-primary/10" title="Abrir demanda">
                          <ExternalLink className="h-4 w-4 text-brand-primary" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
