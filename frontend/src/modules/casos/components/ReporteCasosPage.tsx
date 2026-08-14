// modules/casos/components/ReporteCasosPage.tsx
// Vista global de casos para el equipo (equivalente a ReporteDemandasPage).
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Filter, Gavel, RefreshCw, Search } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
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
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import { getEtiquetasDemanda } from "@/modules/cobranza/services/etiquetaDemandaService";
import {
  buscarCasos,
  cargarOpcionesFiltroCasos,
  type CasoReporteRow,
} from "../services/casoReporteGlobalService";
import { getTiposCaso } from "../services/tipoCasoService";

const TODOS = "__todos__";

const fmt = new Intl.DateTimeFormat("es-CO", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const fmtFecha = (d: Date | null) => (d ? fmt.format(d) : "—");

export default function ReporteCasosPage() {
  const navigate = useNavigate();
  const { roles, usuarioSistema } = useUsuarioActual();
  const { can } = useAcl();

  // Vista transversal del equipo: el rol clienteCaso no la puede abrir a mano.
  const puedeVer = can(PERMS.ClientesParticulares_Read);

  const [rows, setRows] = React.useState<CasoReporteRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState("");

  const [opciones, setOpciones] = React.useState<{
    clientes: { id: string; nombre: string }[];
    abogados: { id: string; nombre: string }[];
    dependientes: { id: string; nombre: string }[];
  }>({ clientes: [], abogados: [], dependientes: [] });
  const [tipos, setTipos] = React.useState<string[]>([]);
  const [etiquetas, setEtiquetas] = React.useState<string[]>([]);

  const [filtros, setFiltros] = React.useState({
    clienteParticularId: TODOS,
    abogadoId: TODOS,
    dependienteId: TODOS,
    estado: TODOS,
    tipoCaso: TODOS,
    etiquetaNombre: TODOS,
  });

  const cargarOpciones = React.useCallback(async () => {
    try {
      const [ops, tps, etqs] = await Promise.all([
        cargarOpcionesFiltroCasos(),
        getTiposCaso(true),
        getEtiquetasDemanda(true),
      ]);
      setOpciones(ops);
      setTipos(tps.map((t) => t.nombre));
      setEtiquetas(etqs.map((e) => e.nombre));
    } catch {
      toast.error("⚠️ No se pudieron cargar los filtros");
    }
  }, []);

  const buscar = React.useCallback(async () => {
    if (!puedeVer) return;
    try {
      setLoading(true);
      const data = await buscarCasos({
        clienteParticularId:
          filtros.clienteParticularId === TODOS ? undefined : filtros.clienteParticularId,
        abogadoId: filtros.abogadoId === TODOS ? undefined : filtros.abogadoId,
        dependienteId: filtros.dependienteId === TODOS ? undefined : filtros.dependienteId,
        estado: filtros.estado === TODOS ? undefined : (filtros.estado as "activo" | "terminado"),
        tipoCaso: filtros.tipoCaso === TODOS ? undefined : filtros.tipoCaso,
        etiquetaNombre:
          filtros.etiquetaNombre === TODOS ? undefined : filtros.etiquetaNombre,
        roles,
        franquiciasAsignadas: usuarioSistema?.franquiciasAsignadas,
      });
      setRows(data);
    } catch {
      toast.error("⚠️ No se pudieron cargar los casos");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filtros, roles, usuarioSistema?.franquiciasAsignadas, puedeVer]);

  React.useEffect(() => {
    cargarOpciones();
  }, [cargarOpciones]);

  React.useEffect(() => {
    buscar();
  }, [buscar]);

  const visibles = React.useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.clienteNombre, r.titulo, r.numeroRadicado, r.juzgado, r.tipoCaso]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, busqueda]);

  const setFiltro = (key: keyof typeof filtros) => (v: string) =>
    setFiltros((s) => ({ ...s, [key]: v }));

  if (!puedeVer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Typography variant="h3">No tienes acceso a esta sección.</Typography>
      </div>
    );
  }

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
                Casos
              </Typography>
              <Typography variant="small">
                Todos los casos de clientes particulares, ordenados por acción más próxima.
              </Typography>
            </div>
          </div>

          <Button variant="outline" onClick={buscar} disabled={loading} className="gap-2 border-brand-secondary/30">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Actualizar
          </Button>
        </header>

        <div className="rounded-2xl border border-brand-secondary/20 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-brand-secondary">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-semibold">Filtros</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FiltroSelect
              label="Cliente"
              value={filtros.clienteParticularId}
              onChange={setFiltro("clienteParticularId")}
              opciones={opciones.clientes.map((c) => ({ value: c.id, label: c.nombre }))}
            />
            <FiltroSelect
              label="Abogado"
              value={filtros.abogadoId}
              onChange={setFiltro("abogadoId")}
              opciones={opciones.abogados.map((c) => ({ value: c.id, label: c.nombre }))}
            />
            <FiltroSelect
              label="Dependiente"
              value={filtros.dependienteId}
              onChange={setFiltro("dependienteId")}
              opciones={opciones.dependientes.map((c) => ({ value: c.id, label: c.nombre }))}
            />
            <FiltroSelect
              label="Estado"
              value={filtros.estado}
              onChange={setFiltro("estado")}
              opciones={[
                { value: "activo", label: "Activo" },
                { value: "terminado", label: "Terminado" },
              ]}
            />
            <FiltroSelect
              label="Tipo de caso"
              value={filtros.tipoCaso}
              onChange={setFiltro("tipoCaso")}
              opciones={tipos.map((t) => ({ value: t, label: t }))}
            />
            <FiltroSelect
              label="Etiqueta"
              value={filtros.etiquetaNombre}
              onChange={setFiltro("etiquetaNombre")}
              opciones={etiquetas.map((t) => ({ value: t, label: t }))}
            />
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por cliente, título, radicado o juzgado"
              className="pl-9 border-brand-secondary/30"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="h-12 w-12 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
            </div>
          ) : visibles.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No hay casos que coincidan con los filtros.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1100px]">
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="text-brand-secondary font-semibold">Cliente</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Caso</TableHead>
                    <TableHead className="w-[140px] text-brand-secondary font-semibold">Tipo</TableHead>
                    <TableHead className="w-[150px] text-brand-secondary font-semibold">Radicado</TableHead>
                    <TableHead className="w-[100px] text-center text-brand-secondary font-semibold">Estado</TableHead>
                    <TableHead className="w-[150px] text-brand-secondary font-semibold">Responsable</TableHead>
                    <TableHead className="w-[140px] text-brand-secondary font-semibold">Próxima acción</TableHead>
                    <TableHead className="w-[140px] text-brand-secondary font-semibold">Última revisión</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.map((r, index) => (
                    <TableRow
                      key={`${r.clienteParticularId}-${r.casoId}`}
                      onClick={() =>
                        navigate(
                          `/clientes-particulares/${r.clienteParticularId}/casos/${r.casoId}`
                        )
                      }
                      className={cn(
                        "border-brand-secondary/5 cursor-pointer transition-colors hover:bg-brand-primary/5",
                        index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]"
                      )}
                    >
                      <TableCell className="font-medium text-gray-800">{r.clienteNombre}</TableCell>
                      <TableCell className="text-gray-700">{r.titulo || "(sin título)"}</TableCell>
                      <TableCell className="text-gray-700">{r.tipoCaso || "—"}</TableCell>
                      <TableCell className="text-gray-700">{r.numeroRadicado || "—"}</TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                            r.estado === "terminado"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-green-100 text-green-800"
                          )}
                        >
                          {r.estado === "terminado" ? "Terminado" : "Activo"}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-700 text-sm">
                        {r.abogadoNombre || r.dependienteNombre || "—"}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {fmtFecha(r.proximaAccionFecha)}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {fmtFecha(r.fechaUltimaRevision)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FiltroSelect({
  label,
  value,
  onChange,
  opciones,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opciones: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="border-brand-secondary/30">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos</SelectItem>
          {opciones.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
