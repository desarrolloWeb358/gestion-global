import { useEffect, useState, useMemo } from "react";
import { Search, X, Filter } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/shared/ui/table";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Typography } from "@/shared/design-system/components/Typography";

import { obtenerRegistrosEliminados } from "../services/registrosEliminadosService";
import { obtenerUsuarios } from "@/modules/usuarios/services/usuarioService";
import type { RegistroEliminado, ModuloApp } from "@/shared/services/auditLog/auditLogModel";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import { cn } from "@/shared/lib/cn";

// ─── Label legible por módulo ────────────────────────────────────────────────
const MODULO_LABEL: Record<ModuloApp, string> = {
  valorAgregado: "Valor Agregado",
  mensajeConversacion: "Mensaje",
  seguimientoPreJuridico: "Seg. Pre-Jurídico",
  seguimientoJuridico: "Seg. Jurídico",
  seguimientoDemanda: "Seg. Demanda",
  observacionCliente: "Observación Cliente",
  historialTipificacion: "Historial Tipificación",
  estadoMensual: "Estado Mensual",
  cliente: "Cliente",
  usuario: "Usuario",
  deudor: "Deudor",
  tarea: "Tarea",
};

// ─── Colores de badge por módulo ─────────────────────────────────────────────
const MODULO_COLOR: Record<ModuloApp, string> = {
  valorAgregado: "bg-amber-100 text-amber-700 border-amber-200",
  mensajeConversacion: "bg-sky-100 text-sky-700 border-sky-200",
  seguimientoPreJuridico: "bg-orange-100 text-orange-700 border-orange-200",
  seguimientoJuridico: "bg-red-100 text-red-700 border-red-200",
  seguimientoDemanda: "bg-rose-100 text-rose-700 border-rose-200",
  observacionCliente: "bg-teal-100 text-teal-700 border-teal-200",
  historialTipificacion: "bg-violet-100 text-violet-700 border-violet-200",
  estadoMensual: "bg-cyan-100 text-cyan-700 border-cyan-200",
  cliente: "bg-blue-100 text-blue-700 border-blue-200",
  usuario: "bg-purple-100 text-purple-700 border-purple-200",
  deudor: "bg-green-100 text-green-700 border-green-200",
  tarea: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

const ALL = "__ALL__";
const MAX_DESC = 60;

const toDate = (v: any): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  return null;
};

export default function RegistrosEliminadosPage() {
  const { can, loading: aclLoading } = useAcl();

  const [registros, setRegistros] = useState<RegistroEliminado[]>([]);
  const [usuarios, setUsuarios] = useState<Record<string, UsuarioSistema>>({});
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState<RegistroEliminado | null>(null);

  // ─── Filtros ───────────────────────────────────────────────────────────────
  const [busqueda, setBusqueda] = useState("");
  const [moduloFiltro, setModuloFiltro] = useState<string>(ALL);
  const [desde, setDesde] = useState<Date | undefined>(undefined);
  const [hasta, setHasta] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (aclLoading) return;
    if (!can(PERMS.RegistrosEliminados_Read)) {
      setLoading(false);
      return;
    }

    const cargar = async () => {
      setLoading(true);
      try {
        const [regs, users] = await Promise.all([
          obtenerRegistrosEliminados(),
          obtenerUsuarios(),
        ]);
        setRegistros(regs);
        const map: Record<string, UsuarioSistema> = {};
        users.forEach((u) => { if (u.uid) map[u.uid] = u; });
        setUsuarios(map);
      } catch (err) {
        console.error("[RegistrosEliminados] Error al cargar:", err);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [aclLoading]);

  // ─── Filtrado ─────────────────────────────────────────────────────────────
  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      if (moduloFiltro !== ALL && r.modulo !== moduloFiltro) return false;

      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        const coincide =
          r.descripcion?.toLowerCase().includes(q) ||
          r.coleccionPath?.toLowerCase().includes(q) ||
          (usuarios[r.uid]?.nombre ?? r.uid).toLowerCase().includes(q) ||
          (usuarios[r.uid]?.email ?? "").toLowerCase().includes(q);
        if (!coincide) return false;
      }

      const fecha = toDate(r.fechaEliminacion);
      if (fecha) {
        if (desde) {
          const d = new Date(desde);
          d.setHours(0, 0, 0, 0);
          if (fecha < d) return false;
        }
        if (hasta) {
          const h = new Date(hasta);
          h.setHours(23, 59, 59, 999);
          if (fecha > h) return false;
        }
      }
      return true;
    });
  }, [registros, moduloFiltro, busqueda, desde, hasta, usuarios]);

  const hayFiltros = busqueda || moduloFiltro !== ALL || desde || hasta;

  const limpiarFiltros = () => {
    setBusqueda("");
    setModuloFiltro(ALL);
    setDesde(undefined);
    setHasta(undefined);
  };

  if (!can(PERMS.RegistrosEliminados_Read)) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No tienes permisos para ver esta sección.
      </div>
    );
  }

  const usuarioDetalle = detalle ? usuarios[detalle.uid] : null;
  const fechaDetalle = detalle ? toDate(detalle.fechaEliminacion) : null;

  return (
    <div className="p-6 space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <Typography variant="h2">Registros Eliminados</Typography>
        <span className="text-sm text-muted-foreground">
          {registrosFiltrados.length} de {registros.length} registros
        </span>
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar descripción, usuario..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8 w-64"
          />
        </div>

        <Select value={moduloFiltro} onValueChange={setModuloFiltro}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-1 text-muted-foreground" />
            <SelectValue placeholder="Módulo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los módulos</SelectItem>
            {(Object.keys(MODULO_LABEL) as ModuloApp[]).map((m) => (
              <SelectItem key={m} value={m}>
                {MODULO_LABEL[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-36 justify-start text-left font-normal", !desde && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {desde ? format(desde, "dd/MM/yyyy") : "Desde"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={desde} onSelect={setDesde} initialFocus locale={es} />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-36 justify-start text-left font-normal", !hasta && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {hasta ? format(hasta, "dd/MM/yyyy") : "Hasta"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={hasta} onSelect={setHasta} initialFocus locale={es} />
          </PopoverContent>
        </Popover>

        {hayFiltros && (
          <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
            <X className="h-4 w-4 mr-1" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Tabla */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Módulo</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-44">Eliminado por</TableHead>
              <TableHead className="w-44">Fecha y hora</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                  Cargando registros...
                </TableCell>
              </TableRow>
            ) : registrosFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                  No se encontraron registros.
                </TableCell>
              </TableRow>
            ) : (
              registrosFiltrados.map((r) => {
                const usuario = usuarios[r.uid];
                const fecha = toDate(r.fechaEliminacion);
                const desc = r.descripcion ?? "";
                const truncada = desc.length > MAX_DESC ? desc.slice(0, MAX_DESC) + "…" : desc;
                return (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setDetalle(r)}
                  >
                    {/* Módulo */}
                    <TableCell>
                      <span
                        className={cn(
                          "inline-block px-2 py-0.5 rounded-full text-xs font-medium border",
                          MODULO_COLOR[r.modulo] ?? "bg-gray-100 text-gray-700 border-gray-200"
                        )}
                      >
                        {MODULO_LABEL[r.modulo] ?? r.modulo}
                      </span>
                    </TableCell>

                    {/* Descripción truncada */}
                    <TableCell className="text-sm">
                      <span>{truncada}</span>
                      {desc.length > MAX_DESC && (
                        <span className="ml-1 text-xs text-primary underline underline-offset-2">
                          ver más
                        </span>
                      )}
                    </TableCell>

                    {/* Usuario */}
                    <TableCell>
                      {usuario ? (
                        <div>
                          <p className="text-sm font-medium">{usuario.nombre ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{usuario.email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground font-mono">{r.uid}</span>
                      )}
                    </TableCell>

                    {/* Fecha */}
                    <TableCell className="text-sm text-muted-foreground">
                      {fecha ? format(fecha, "dd/MM/yyyy HH:mm:ss", { locale: es }) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog de detalle */}
      <Dialog open={!!detalle} onOpenChange={(open) => { if (!open) setDetalle(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle del registro eliminado</DialogTitle>
          </DialogHeader>

          {detalle && (
            <div className="space-y-4 text-sm">
              {/* Módulo */}
              <div className="flex items-center gap-2">
                <span className="font-medium text-muted-foreground w-32 shrink-0">Módulo</span>
                <span
                  className={cn(
                    "inline-block px-2 py-0.5 rounded-full text-xs font-medium border",
                    MODULO_COLOR[detalle.modulo] ?? "bg-gray-100 text-gray-700 border-gray-200"
                  )}
                >
                  {MODULO_LABEL[detalle.modulo] ?? detalle.modulo}
                </span>
              </div>

              {/* Descripción completa */}
              <div className="flex gap-2">
                <span className="font-medium text-muted-foreground w-32 shrink-0">Descripción</span>
                <span className="leading-relaxed">{detalle.descripcion}</span>
              </div>

              {/* Ruta colección */}
              <div className="flex gap-2">
                <span className="font-medium text-muted-foreground w-32 shrink-0">Ruta colección</span>
                <span className="font-mono text-xs break-all">{detalle.coleccionPath}</span>
              </div>

              {/* Usuario */}
              <div className="flex gap-2">
                <span className="font-medium text-muted-foreground w-32 shrink-0">Eliminado por</span>
                <div>
                  {usuarioDetalle ? (
                    <>
                      <p className="font-medium">{usuarioDetalle.nombre ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{usuarioDetalle.email}</p>
                    </>
                  ) : (
                    <span className="font-mono text-xs">{detalle.uid}</span>
                  )}
                </div>
              </div>

              {/* Fecha */}
              <div className="flex gap-2">
                <span className="font-medium text-muted-foreground w-32 shrink-0">Fecha y hora</span>
                <span>
                  {fechaDetalle
                    ? format(fechaDetalle, "dd 'de' MMMM 'de' yyyy, HH:mm:ss", { locale: es })
                    : "—"}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
