// modules/valoresAgregados/components/ReporteValoresAgregadosPage.tsx
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  Scale,
  Search,
  Download,
  Filter as FilterIcon,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
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
import { PERMS } from "@/shared/constants/acl";
import type { Rol } from "@/shared/constants/acl";
import {
  TipoValorAgregado,
  TipoValorAgregadoLabels,
} from "@/shared/constants/tipoValorAgregado";
import {
  buscarValoresAgregados,
  cargarOpcionesFiltroValoresAgregados,
  type ValorAgregadoGlobalRow,
  type ValorAgregadoGlobalFiltros,
} from "../services/valorAgregadoReporteGlobalService";

const fmt = new Intl.DateTimeFormat("es-CO", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const fmtD = (d: Date | null) => (d ? fmt.format(d) : "—");

const TODOS = "todos";

/** Un plazo vencido sin resolver es lo único que se pinta en rojo. */
function VencimientoCell({ row }: { row: ValorAgregadoGlobalRow }) {
  if (!row.fechaLimite) return <span className="text-muted-foreground">—</span>;
  const v = row.diasVencido;

  if (v === null) {
    return <span className="text-muted-foreground">{fmtD(row.fechaLimite)}</span>;
  }
  if (v > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-red-700">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        {v} {v === 1 ? "día" : "días"}
      </span>
    );
  }
  return (
    <span className={cn("text-sm", v > -3 ? "text-amber-700 font-medium" : "text-gray-600")}>
      {fmtD(row.fechaLimite)}
    </span>
  );
}

function EstadoPill({ row }: { row: ValorAgregadoGlobalRow }) {
  const resuelto = row.estado === "resuelto";
  return (
    <div className="flex flex-col gap-1 items-start">
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
          resuelto
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-amber-50 text-amber-800 border-amber-200"
        )}
      >
        {resuelto ? "Resuelto" : "Abierto"}
      </span>
      {row.requiereRevision && (
        <span
          className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700"
          title="La migración no pudo determinar el estado con certeza. Revísalo y márcalo a mano."
        >
          Revisar
        </span>
      )}
    </div>
  );
}

export default function ReporteValoresAgregadosPage() {
  const navigate = useNavigate();
  const acl = useAcl() as { roles: Rol[]; can: (p: any) => boolean };
  const roles = Array.isArray(acl.roles) ? acl.roles : [];
  const uid = getAuth().currentUser?.uid ?? null;

  const canView = acl.can(PERMS.Valores_agregados_Read);

  // Admin, supervisor y ejecutivoAdmin ven todo; abogado y dependiente solo lo suyo.
  const esGlobal =
    roles.includes("admin") ||
    roles.includes("supervisor") ||
    roles.includes("ejecutivoAdmin");
  // Tener el rol precarga el filtro con uno mismo. Bloquearlo es distinto: solo
  // se bloquea a quien NO tiene acceso global, para que un admin que además es
  // abogado entre viendo lo suyo pero pueda mirar el de otros.
  const esAbogado = roles.includes("abogado");
  const esDependiente = roles.includes("dependiente");
  const soloAbogado = !esGlobal && esAbogado;
  const soloDependiente = !esGlobal && !soloAbogado && esDependiente;
  const acotadoAsuUsuario = soloAbogado || soloDependiente;

  const [opts, setOpts] = React.useState<{
    clientes: { id: string; nombre: string }[];
    abogados: { id: string; nombre: string }[];
    dependientes: { id: string; nombre: string }[];
  }>({ clientes: [], abogados: [], dependientes: [] });
  const [cargandoOpciones, setCargandoOpciones] = React.useState(true);

  const [rows, setRows] = React.useState<ValorAgregadoGlobalRow[]>([]);
  const [buscando, setBuscando] = React.useState(false);
  const [buscado, setBuscado] = React.useState(false);

  // Filtros. Por defecto lo que le duele al área jurídica: abierto y en su cancha.
  const [fCliente, setFCliente] = React.useState<string>(TODOS);
  const [fAbogado, setFAbogado] = React.useState<string>(TODOS);
  const [fDependiente, setFDependiente] = React.useState<string>(TODOS);
  const [fEstado, setFEstado] = React.useState<string>("abierto");
  const [fEspera, setFEspera] = React.useState<string>("juridica");
  const [fTipo, setFTipo] = React.useState<string>(TODOS);
  const [fVencidos, setFVencidos] = React.useState(false);
  const [fRevisar, setFRevisar] = React.useState(false);

  React.useEffect(() => {
    if (!canView) return;
    (async () => {
      try {
        setCargandoOpciones(true);
        const o = await cargarOpcionesFiltroValoresAgregados();
        setOpts(o);
        // Solo precargamos si el usuario aparece en las opciones, es decir si
        // realmente tiene clientes asignados; si no, el Select mostraría un
        // valor que no existe en la lista.
        if (uid) {
          if (esAbogado && o.abogados.some((a) => a.id === uid)) setFAbogado(uid);
          else if (esDependiente && o.dependientes.some((d) => d.id === uid))
            setFDependiente(uid);
        }
      } catch {
        toast.error("⚠️ No se pudieron cargar los filtros");
      } finally {
        setCargandoOpciones(false);
      }
    })();
  }, [canView, esAbogado, esDependiente, uid]);

  const buscar = async () => {
    const filtros: ValorAgregadoGlobalFiltros = {
      clienteId: fCliente !== TODOS ? fCliente : undefined,
      abogadoId: fAbogado !== TODOS ? fAbogado : undefined,
      dependienteId: fDependiente !== TODOS ? fDependiente : undefined,
      estado: fEstado !== TODOS ? (fEstado as any) : undefined,
      esperaRespuestaDe: fEspera !== TODOS ? (fEspera as any) : undefined,
      tipo: fTipo !== TODOS ? (fTipo as TipoValorAgregado) : undefined,
      soloVencidos: fVencidos,
      soloRequierenRevision: fRevisar,
    };
    try {
      setBuscando(true);
      const res = await buscarValoresAgregados(filtros);
      setRows(res);
      setBuscado(true);
    } catch (e) {
      console.error(e);
      toast.error("⚠️ No se pudo cargar el reporte de valores agregados");
    } finally {
      setBuscando(false);
    }
  };

  /** "Requiere revisión" es transversal, no un filtro más del mismo eje: quien lo
   *  marca quiere ver TODOS los pendientes de revisar. Cruzarlo en silencio con el
   *  estado y el turno por defecto daba cero resultados y parecía un error. */
  const toggleRevisar = (checked: boolean) => {
    setFRevisar(checked);
    if (checked) {
      setFEstado(TODOS);
      setFEspera(TODOS);
    }
  };

  const limpiar = () => {
    setFCliente(TODOS);
    setFAbogado(esAbogado && uid && opts.abogados.some((a) => a.id === uid) ? uid : TODOS);
    setFDependiente(
      !esAbogado && esDependiente && uid && opts.dependientes.some((d) => d.id === uid)
        ? uid
        : TODOS
    );
    setFEstado("abierto");
    setFEspera("juridica");
    setFTipo(TODOS);
    setFVencidos(false);
    setFRevisar(false);
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
      Tipo: r.tipoLabel,
      Título: r.titulo,
      Estado: r.estado === "resuelto" ? "Resuelto" : "Abierto",
      Espera: r.esperaRespuestaDe === "juridica" ? "Jurídica" : "Cliente",
      Abogado: r.abogadoNombre,
      Dependiente: r.dependienteNombre,
      Radicado: r.fechaSolicitud ? fmt.format(r.fechaSolicitud) : "",
      "Plazo límite": r.fechaLimite ? fmt.format(r.fechaLimite) : "",
      "Días vencido": r.diasVencido !== null && r.diasVencido > 0 ? r.diasVencido : "",
      "Días abierto": r.diasAbierto ?? "",
      Resuelto: r.fechaResolucion ? fmt.format(r.fechaResolucion) : "",
      "Requiere revisión": r.requiereRevision ? "Sí" : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 30 }, { wch: 20 }, { wch: 38 }, { wch: 10 }, { wch: 10 },
      { wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Valores agregados");
    XLSX.writeFile(
      wb,
      `Valores_Agregados_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  if (!canView) {
    return (
      <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
        <Typography variant="body">No tienes acceso a Valores agregados.</Typography>
      </div>
    );
  }

  const vencidos = rows.filter((r) => (r.diasVencido ?? -1) > 0).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Scale className="h-6 w-6 text-brand-primary" />
            </div>
            <div>
              <Typography variant="h1" className="!text-brand-primary font-bold">
                Valores agregados
              </Typography>
              <Typography variant="small">
                {buscado
                  ? `${rows.length} trámite(s)${vencidos > 0 ? ` · ${vencidos} con plazo vencido` : ""}`
                  : "Ajusta los filtros y presiona Buscar"}
                {acotadoAsuUsuario && " · solo tus clientes"}
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
              <Typography variant="h3" className="!text-brand-secondary font-semibold">
                Filtros
              </Typography>
            </div>
            <Button variant="ghost" size="sm" onClick={limpiar}>
              Limpiar
            </Button>
          </div>

          <div className="p-4 md:p-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Estado</Label>
              <Select value={fEstado} onValueChange={setFEstado}>
                <SelectTrigger className="border-brand-secondary/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="abierto">Abiertos</SelectItem>
                  <SelectItem value="resuelto">Resueltos</SelectItem>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Esperando respuesta de</Label>
              <Select value={fEspera} onValueChange={setFEspera}>
                <SelectTrigger className="border-brand-secondary/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="juridica">Jurídica (nuestra cancha)</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value={TODOS}>Indiferente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={fTipo} onValueChange={setFTipo}>
                <SelectTrigger className="border-brand-secondary/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {Object.values(TipoValorAgregado).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TipoValorAgregadoLabels[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cliente</Label>
              <Select
                value={fCliente}
                onValueChange={setFCliente}
                disabled={cargandoOpciones}
              >
                <SelectTrigger className="border-brand-secondary/30">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {opts.clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Abogado</Label>
              <Select
                value={fAbogado}
                onValueChange={setFAbogado}
                disabled={cargandoOpciones || soloAbogado}
              >
                <SelectTrigger className="border-brand-secondary/30">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {opts.abogados.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dependiente</Label>
              <Select
                value={fDependiente}
                onValueChange={setFDependiente}
                disabled={cargandoOpciones || soloDependiente}
              >
                <SelectTrigger className="border-brand-secondary/30">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {opts.dependientes.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="px-4 md:px-5 pb-4 md:pb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fVencidos}
                  onChange={(e) => setFVencidos(e.target.checked)}
                  className="h-4 w-4 rounded border-brand-secondary/40 accent-brand-primary"
                />
                Solo con plazo vencido
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fRevisar}
                  onChange={(e) => toggleRevisar(e.target.checked)}
                  className="h-4 w-4 rounded border-brand-secondary/40 accent-brand-primary"
                />
                Solo los que requieren revisión
              </label>
            </div>
            <Button
              variant="brand"
              onClick={buscar}
              disabled={buscando || cargandoOpciones}
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
              Ajusta los filtros y presiona <strong>Buscar</strong> para ver los valores agregados.
            </p>
          </div>
        ) : buscando ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
            <div className="h-12 w-12 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm text-muted-foreground">
            No hay valores agregados que cumplan los filtros.
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="text-brand-secondary font-semibold">Cliente</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Tipo</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Título</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Estado</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Espera</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Radicado</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Plazo</TableHead>
                    <TableHead className="text-center text-brand-secondary font-semibold">Ir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, index) => (
                    <TableRow
                      key={`${r.clienteId}-${r.valorId}`}
                      className={cn(
                        "border-brand-secondary/5",
                        index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]",
                        "hover:bg-brand-primary/5"
                      )}
                    >
                      <TableCell className="text-gray-700 max-w-[220px] truncate" title={r.clienteNombre}>
                        {r.clienteNombre}
                      </TableCell>
                      <TableCell className="text-gray-700 whitespace-nowrap">{r.tipoLabel}</TableCell>
                      <TableCell className="font-medium text-gray-800 max-w-[280px] truncate" title={r.titulo}>
                        {r.titulo || "—"}
                      </TableCell>
                      <TableCell>
                        <EstadoPill row={r} />
                      </TableCell>
                      <TableCell className="text-gray-700 whitespace-nowrap">
                        {r.esperaRespuestaDe === "juridica" ? "Jurídica" : "Cliente"}
                      </TableCell>
                      <TableCell className="text-gray-600 whitespace-nowrap tabular-nums">
                        {fmtD(r.fechaSolicitud)}
                        {r.diasAbierto !== null && (
                          <span className="block text-xs text-muted-foreground">
                            hace {r.diasAbierto}d
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        <VencimientoCell row={r} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            navigate(`/clientes/${r.clienteId}/valores-agregados/${r.valorId}`)
                          }
                          className="hover:bg-brand-primary/10"
                          title="Abrir valor agregado"
                        >
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
