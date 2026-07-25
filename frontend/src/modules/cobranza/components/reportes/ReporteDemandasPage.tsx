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
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import type { Rol } from "@/shared/constants/acl";
import {
  buscarDemandas,
  cargarOpcionesFiltroDemandas,
  type DemandaReporteRow,
  type DemandaReporteFiltros,
} from "../../services/reportes/demandaReporteGlobalService";
import { getEtiquetasDemanda } from "../../services/etiquetaDemandaService";

const fmt = new Intl.DateTimeFormat("es-CO", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const fmtD = (d: Date | null) => (d ? fmt.format(d) : "—");

type CampoFecha = "fechaUltimaRevision" | "fechaCreacion" | "proximaAccionFecha";

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
  const [clientesOpts, setClientesOpts] = React.useState<{ id: string; nombre: string }[]>([]);
  const [dependientesOpts, setDependientesOpts] = React.useState<{ id: string; nombre: string }[]>([]);
  const [etiquetasOpts, setEtiquetasOpts] = React.useState<string[]>([]);
  const [cargandoOpciones, setCargandoOpciones] = React.useState(true);

  // Resultados (solo tras presionar Buscar)
  const [rows, setRows] = React.useState<DemandaReporteRow[]>([]);
  const [buscando, setBuscando] = React.useState(false);
  const [buscado, setBuscado] = React.useState(false);

  // Estado de filtros
  const [fCliente, setFCliente] = React.useState<string>("todos");
  const [fDependiente, setFDependiente] = React.useState<string>("todos");
  const [fEstado, setFEstado] = React.useState<string>("todos");
  const [fEtiqueta, setFEtiqueta] = React.useState<string>("todas");
  const [fSinCoteje, setFSinCoteje] = React.useState(false);
  const [campoFecha, setCampoFecha] = React.useState<CampoFecha>("proximaAccionFecha");
  const [desde, setDesde] = React.useState("");
  const [hasta, setHasta] = React.useState("");

  React.useEffect(() => {
    (async () => {
      try {
        setCargandoOpciones(true);
        const [op, etis] = await Promise.all([
          cargarOpcionesFiltroDemandas(),
          getEtiquetasDemanda(true),
        ]);
        setClientesOpts(op.clientes);
        setDependientesOpts(op.dependientes);
        setEtiquetasOpts(etis.map((e) => e.nombre).filter(Boolean));
      } catch {
        toast.error("⚠️ No se pudieron cargar los filtros");
      } finally {
        setCargandoOpciones(false);
      }
    })();
  }, []);

  // El dependiente siempre queda acotado a lo suyo (su uid).
  const dependienteEfectivo = soloDependiente ? uid ?? undefined : undefined;

  // ¿Hay al menos un filtro que permita buscar?
  const hayFiltro =
    fCliente !== "todos" ||
    fDependiente !== "todos" ||
    fEstado !== "todos" ||
    fEtiqueta !== "todas" ||
    fSinCoteje ||
    !!desde ||
    !!hasta ||
    soloDependiente;

  // Acotable al servidor por cliente/dependiente (búsqueda liviana).
  const busquedaAcotada =
    fCliente !== "todos" || fDependiente !== "todos" || !!dependienteEfectivo;

  const buscar = async () => {
    if (!hayFiltro) {
      toast.error("Selecciona al menos un filtro antes de buscar.");
      return;
    }
    const filtros: DemandaReporteFiltros = {
      clienteId: fCliente !== "todos" ? fCliente : undefined,
      ejecutivoDependienteId:
        dependienteEfectivo ?? (fDependiente !== "todos" ? fDependiente : undefined),
      estado: fEstado !== "todos" ? (fEstado as DemandaReporteRow["estado"]) : undefined,
      etiquetaNombre: fEtiqueta !== "todas" ? fEtiqueta : undefined,
      soloSinCoteje: fSinCoteje,
      campoFecha,
      desde: desde ? new Date(`${desde}T00:00:00`) : undefined,
      hasta: hasta ? new Date(`${hasta}T23:59:59`) : undefined,
    };
    try {
      setBuscando(true);
      const res = await buscarDemandas(filtros);
      setRows(res);
      setBuscado(true);
    } catch {
      toast.error("⚠️ No se pudo cargar el reporte de demandas");
    } finally {
      setBuscando(false);
    }
  };

  const resetFiltros = () => {
    setFCliente("todos");
    setFDependiente("todos");
    setFEstado("todos");
    setFEtiqueta("todas");
    setFSinCoteje(false);
    setCampoFecha("proximaAccionFecha");
    setDesde("");
    setHasta("");
    setRows([]);
    setBuscado(false);
  };

  const exportar = () => {
    if (rows.length === 0) {
      toast.error("No hay filas para exportar.");
      return;
    }
    const data = rows.map((r) => ({
      Cliente: r.clienteNombre,
      Deudor: r.deudorNombre,
      Ubicación: r.ubicacion,
      Radicado: r.numeroRadicado,
      Juzgado: r.juzgado,
      Localidad: r.localidad,
      Estado: r.estado,
      Dependiente: r.ejecutivoDependienteNombre,
      Demandados: r.totalDemandados,
      "Notif. sin coteje": r.notificacionesSinCoteje,
      Etiquetas: r.etiquetas.map((e) => e.nombre).join(", "),
      "Próxima acción": r.proximaAccionFecha ? fmt.format(r.proximaAccionFecha) : "",
      "Última revisión": r.fechaUltimaRevision ? fmt.format(r.fechaUltimaRevision) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 24 }, { wch: 26 }, { wch: 12 }, { wch: 26 }, { wch: 22 },
      { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 11 }, { wch: 14 },
      { wch: 28 }, { wch: 14 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Demandas");
    XLSX.writeFile(wb, `Reporte_Demandas_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
            <Button variant="brand" onClick={exportar} className="gap-2">
              <Download className="h-4 w-4" /> Exportar Excel
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
            {!soloDependiente && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Dependiente</Label>
                <Select value={fDependiente} onValueChange={setFDependiente} disabled={cargandoOpciones}>
                  <SelectTrigger className="border-brand-secondary/30"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {dependientesOpts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cliente / conjunto</Label>
              <Select value={fCliente} onValueChange={setFCliente} disabled={cargandoOpciones}>
                <SelectTrigger className="border-brand-secondary/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {clientesOpts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Estado</Label>
              <Select value={fEstado} onValueChange={setFEstado}>
                <SelectTrigger className="border-brand-secondary/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="activa">Activa</SelectItem>
                  <SelectItem value="terminada">Terminada</SelectItem>
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
              <Label className="text-xs text-muted-foreground">Filtrar fechas por</Label>
              <Select value={campoFecha} onValueChange={(v) => setCampoFecha(v as CampoFecha)}>
                <SelectTrigger className="border-brand-secondary/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="proximaAccionFecha">Próxima acción (etiqueta)</SelectItem>
                  <SelectItem value="fechaUltimaRevision">Última revisión</SelectItem>
                  <SelectItem value="fechaCreacion">Creación</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Desde</Label>
                <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="border-brand-secondary/30" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Hasta</Label>
                <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="border-brand-secondary/30" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer self-end pb-2">
              <input type="checkbox" checked={fSinCoteje} onChange={(e) => setFSinCoteje(e.target.checked)} className="h-4 w-4 rounded border-brand-secondary/40" />
              Solo con notificaciones sin coteje
            </label>
          </div>
          <div className="px-4 md:px-5 pb-4 md:pb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {busquedaAcotada
                ? "Búsqueda acotada por cliente/dependiente (rápida)."
                : "Sugerencia: filtra por cliente o dependiente para una consulta más rápida."}
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
            <div className="overflow-x-auto">
              <Table className="min-w-[1100px]">
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="text-brand-secondary font-semibold">Cliente</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Deudor</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Radicado</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Juzgado</TableHead>
                    <TableHead className="w-[90px] text-center text-brand-secondary font-semibold">Estado</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Dependiente</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Etiquetas</TableHead>
                    <TableHead className="w-[90px] text-center text-brand-secondary font-semibold">Sin coteje</TableHead>
                    <TableHead className="w-[120px] text-brand-secondary font-semibold">Próx. acción</TableHead>
                    <TableHead className="w-[60px] text-center text-brand-secondary font-semibold">Ir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, index) => (
                    <TableRow key={`${r.clienteId}-${r.deudorId}-${r.demandaId}`} className={cn("border-brand-secondary/5", index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]", "hover:bg-brand-primary/5")}>
                      <TableCell className="text-gray-700">{r.clienteNombre}</TableCell>
                      <TableCell className="font-medium text-gray-800">{r.deudorNombre || "—"}</TableCell>
                      <TableCell className="text-gray-700 font-mono text-xs">{r.numeroRadicado || "—"}</TableCell>
                      <TableCell className="text-gray-700">{r.juzgado || "—"}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", r.estado === "terminada" ? "bg-gray-100 text-gray-700" : "bg-green-100 text-green-800")}>
                          {r.estado === "terminada" ? "Term." : "Activa"}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-700">{r.ejecutivoDependienteNombre || "—"}</TableCell>
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
                        {r.notificacionesSinCoteje > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-semibold">
                            {r.notificacionesSinCoteje}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-700">{fmtD(r.proximaAccionFecha)}</TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/clientes/${r.clienteId}/deudores/${r.deudorId}/demandas/${r.demandaId}`)} className="hover:bg-brand-primary/10" title="Abrir demanda">
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
