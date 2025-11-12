// src/modules/cobranza/components/ValoresAgregadosTable.tsx
"use client";

import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { 
  Loader2, 
  Calendar as CalendarIcon, 
  X, 
  Plus, 
  Edit, 
  Eye, 
  FileText,
  Filter as FilterIcon,
  Upload,
  Trash2,
  Search
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/shared/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/ui/select";
import { Label } from "@/shared/ui/label";
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";


import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";

import { ValorAgregado } from "../models/valorAgregado.model";
import {
  listarValoresAgregados,
  crearValorAgregado,
  actualizarValorAgregado,
  formatFechaCO as formatFechaCOOriginal,
} from "../services/valorAgregadoService";

import { TipoValorAgregado, TipoValorAgregadoLabels } from "../../../shared/constants/tipoValorAgregado";
import { BackButton } from "@/shared/design-system/components/BackButton";

// =======================
// ErrorBoundary con detalle
// =======================
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message?: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, message: undefined };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: (err && (err.message || String(err))) || "Error desconocido" };
  }
  componentDidCatch(error: Error) {
    console.error("Error capturado en ValoresAgregadosTable:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <X className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <Typography variant="h3" className="text-red-700 font-semibold">
                Ocurrió un error
              </Typography>
              {this.state.message && (
                <Typography variant="small" className="text-red-600 mt-1">
                  {this.state.message}
                </Typography>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// =======================
// Helpers seguros
// =======================
function toDateAny(v: any): Date | undefined {
  try {
    if (!v) return undefined;
    if (typeof v.toDate === "function") return v.toDate();
    if (v instanceof Date) return v;
  } catch {}
  return undefined;
}
function normalizeStart(d?: Date) {
  if (!d) return undefined;
  const x = new Date(d); x.setHours(0,0,0,0); return x;
}
function normalizeEnd(d?: Date) {
  if (!d) return undefined;
  const x = new Date(d); x.setHours(23,59,59,999); return x;
}
function formatBytes(bytes: number) {
  if (!bytes && bytes !== 0) return "";
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(val > 10 ? 0 : 1)} ${sizes[i]}`;
}
function safeTipoLabel(tipo?: string) {
  return (tipo && (TipoValorAgregadoLabels as any)[tipo]) || tipo || "—";
}
function formatFechaCO(value: any) {
  try {
    const out = formatFechaCOOriginal(value);
    if (out) return out;
  } catch {}
  const d = toDateAny(value);
  return d ? d.toLocaleDateString("es-CO") : "—";
}

const ALL = "__ALL__";

// =======================
// Componente principal
// =======================
export default function ValoresAgregadosTable() {
  const navigate = useNavigate();
  const { clienteId } = useParams<{ clienteId: string }>();

  const { can, roles = [], loading: aclLoading } = useAcl();
  const canView = can(PERMS.Valores_Read);
  const canEdit = canView && !roles.includes("cliente");

  const [items, setItems] = React.useState<ValorAgregado[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Crear / Editar
  const [open, setOpen] = React.useState(false);
  const [editando, setEditando] = React.useState<ValorAgregado | null>(null);
  const [formData, setFormData] = React.useState<Partial<ValorAgregado>>({});
  const [archivoFile, setArchivoFile] = React.useState<File | undefined>(undefined);
  const [fecha, setFecha] = React.useState<Date | undefined>();
  const [saving, setSaving] = React.useState(false);

  // Paginación
  const [page, setPage] = React.useState(1);
  const itemsPerPage = 10;

  // Filtros
  const [q, setQ] = React.useState("");
  const [tipoFilter, setTipoFilter] = React.useState<string>(ALL);
  const [dateFrom, setDateFrom] = React.useState<Date | undefined>();
  const [dateTo, setDateTo] = React.useState<Date | undefined>();

  const MAX_FILE_MB = 15;

  // =======================
  // Carga de datos
  // =======================
  const fetchData = async () => {
    if (!clienteId) return;
    setLoading(true);
    try {
      const data = await listarValoresAgregados(clienteId);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error("⚠️ No se pudieron cargar los valores agregados");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!canView) return;
    fetchData();
  }, [clienteId, canView]);

  // =======================
  // Filtro + paginación
  // =======================
  const filtered = React.useMemo(() => {
    const nq = q.trim().toLowerCase();
    const from = normalizeStart(dateFrom);
    const to = normalizeEnd(dateTo);

    return (items || []).filter((it) => {
      if (nq) {
        const hay = ((it?.titulo ?? "") + " " + (it?.descripcion ?? "")).toLowerCase();
        if (!hay.includes(nq)) return false;
      }
      if (tipoFilter !== ALL) {
        if (it?.tipo !== (tipoFilter as TipoValorAgregado)) return false;
      }
      if (from || to) {
        const d = toDateAny((it as any)?.fecha);
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      return true;
    });
  }, [items, q, tipoFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = React.useMemo(
    () => filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage),
    [filtered, page]
  );

  React.useEffect(() => {
    setPage(1);
  }, [q, tipoFilter, dateFrom, dateTo, items.length]);

  // =======================
  // Acciones
  // =======================
  const iniciarCrear = () => {
    if (!canEdit) return;
    setEditando(null);
    setFormData({ tipo: TipoValorAgregado.DERECHO_DE_PETICION, titulo: "", descripcion: "" });
    setArchivoFile(undefined);
    setFecha(undefined);
    setOpen(true);
  };

  const iniciarEditar = (it: ValorAgregado) => {
    if (!canEdit) return;
    setEditando(it || null);
    setFormData({ ...(it || {}) });
    const f: any = (it as any)?.fecha;
    setFecha(f?.toDate ? f.toDate() : undefined);
    setArchivoFile(undefined);
    setOpen(true);
  };

  const goDetalle = (it: ValorAgregado) => {
    if (!clienteId || !it?.id) return;
    navigate(`/clientes/${clienteId}/valores-agregados/${it.id}`);
  };

  const onSubmit = async () => {
    if (!clienteId || saving || !canEdit) return;
    setSaving(true);
    try {
      const fechaTs = fecha ? Timestamp.fromDate(fecha) : undefined;

      if (editando?.id) {
        await actualizarValorAgregado(
          clienteId,
          editando.id,
          { ...formData, fechaTs },
          archivoFile
        );
        toast.success("✓ Valor agregado actualizado");
      } else {
        await crearValorAgregado(
          clienteId,
          {
            tipo: (formData.tipo as TipoValorAgregado) ?? TipoValorAgregado.DERECHO_DE_PETICION,
            titulo: formData.titulo ?? "",
            descripcion: formData.descripcion ?? "",
            fechaTs,
          },
          archivoFile
        );
        toast.success("✓ Valor agregado creado");
      }

      setOpen(false);
      await fetchData();
      setArchivoFile(undefined);
    } catch (e) {
      console.error(e);
      toast.error("⚠️ Error guardando el valor agregado");
    } finally {
      setSaving(false);
    }
  };

  // =======================
  // Render
  // =======================
  if (aclLoading) {
    return (
      <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-3" />
        <Typography variant="small" className="text-muted">
          Cargando permisos...
        </Typography>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
        <Typography variant="body" className="text-muted">
          No tienes acceso a Valores agregados.
        </Typography>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-4">
        {/* Overlay guardando */}
        {saving && (
          <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <div className="rounded-xl bg-white shadow-lg px-6 py-5 flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
              <Typography variant="body" className="font-medium">
                Guardando cambios...
              </Typography>
            </div>
          </div>
        )}

        {/* Back Button */}
        <BackButton />

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-primary/10">
              <FileText className="h-6 w-6 text-brand-primary" />
            </div>
            <Typography variant="h2" className="!text-brand-secondary">
              Valores Agregados
            </Typography>
          </div>

          {canEdit && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={iniciarCrear}
                  disabled={saving}
                  variant="brand"
                  className="gap-2 shadow-md hover:shadow-lg transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Crear valor agregado
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-brand-primary text-xl font-bold flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {editando ? "Editar valor agregado" : "Crear valor agregado"}
                  </DialogTitle>
                </DialogHeader>

                <form className="space-y-4 py-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-brand-secondary font-medium">Tipo *</Label>
                      <Select
                        value={(formData.tipo as TipoValorAgregado) ?? TipoValorAgregado.DERECHO_DE_PETICION}
                        onValueChange={(val) => setFormData((prev) => ({ ...prev, tipo: val as TipoValorAgregado }))}
                        disabled={saving}
                      >
                        <SelectTrigger className="border-brand-secondary/30">
                          <SelectValue placeholder="Selecciona" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(TipoValorAgregado).map((t) => (
                            <SelectItem key={t} value={t}>{TipoValorAgregadoLabels[t]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-brand-secondary font-medium flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        Fecha
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal border-brand-secondary/30",
                              !fecha && "text-muted-foreground"
                            )}
                            disabled={saving}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {fecha ? fecha.toLocaleDateString("es-CO") : "Selecciona una fecha"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={fecha} onSelect={setFecha} initialFocus />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-brand-secondary font-medium">Título *</Label>
                    <Input
                      value={formData.titulo ?? ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, titulo: e.target.value }))}
                      disabled={saving}
                      className="border-brand-secondary/30"
                      placeholder="Título del valor agregado"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-brand-secondary font-medium">Descripción</Label>
                    <Textarea
                      value={formData.descripcion ?? ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, descripcion: e.target.value }))}
                      disabled={saving}
                      placeholder="Anota contexto, acuerdos, radicados, notas internas…"
                      className="min-h-40 border-brand-secondary/30"
                      maxLength={1000}
                    />
                  </div>

                  {/* Archivo adjunto */}
                  <div className="space-y-2">
                    <Label className="text-brand-secondary font-medium flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Archivo adjunto
                    </Label>

                    {editando && (editando.archivoNombre || editando.archivoPath || editando.archivoURL) && !archivoFile && (
                      <div className="text-xs text-muted-foreground p-3 rounded-lg bg-blue-50 border border-blue-100">
                        {editando.archivoNombre
                          ? <>Actual: <span className="font-medium">{editando.archivoNombre}</span></>
                          : <>Hay un archivo adjunto guardado.</>}
                        <br />
                        <span>Si seleccionas un nuevo archivo, reemplazará al actual.</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Input
                        id="archivo-valor-agregado"
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                        disabled={saving}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) {
                            setArchivoFile(undefined);
                            return;
                          }
                          const tooBig = f.size > MAX_FILE_MB * 1024 * 1024;
                          if (tooBig) {
                            toast.error(`El archivo supera ${MAX_FILE_MB} MB`);
                            e.currentTarget.value = "";
                            return;
                          }
                          setArchivoFile(f);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={saving}
                        onClick={() => document.getElementById("archivo-valor-agregado")?.click()}
                        className="border-brand-secondary/30"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Seleccionar archivo
                      </Button>

                      {archivoFile ? (
                        <div className="text-sm flex items-center gap-2 flex-1">
                          <FileText className="h-4 w-4 text-brand-primary" />
                          <span className="font-medium">{archivoFile.name}</span>
                          <span className="text-muted-foreground">({formatBytes(archivoFile.size)})</span>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No hay archivo seleccionado</div>
                      )}

                      {archivoFile && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setArchivoFile(undefined)}
                          disabled={saving}
                          className="hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Formatos permitidos: PDF, Word, Excel, JPG/PNG. Tamaño máximo: {MAX_FILE_MB} MB.
                    </p>
                  </div>
                </form>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setOpen(false);
                      setArchivoFile(undefined);
                    }}
                    disabled={saving}
                    className="border-brand-secondary/30"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={onSubmit}
                    disabled={saving}
                    variant="brand"
                    className="gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Guardar
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Filtros */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <div className="flex items-center gap-2">
              <FilterIcon className="h-5 w-5 text-brand-primary" />
              <Typography variant="h3" className="!text-brand-secondary font-semibold">
                Filtros de búsqueda
              </Typography>
            </div>
          </div>

          <div className="p-4 md:p-5">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Búsqueda */}
              <div className="lg:col-span-2 space-y-2">
                <Label className="text-brand-secondary font-medium flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Búsqueda
                </Label>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por título o descripción…"
                  className="border-brand-secondary/30"
                />
              </div>

              {/* Tipo */}
              <div className="space-y-2">
                <Label className="text-brand-secondary font-medium">Tipo</Label>
                <Select
                  value={tipoFilter}
                  onValueChange={(v) => setTipoFilter(v)}
                >
                  <SelectTrigger className="border-brand-secondary/30">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {Object.values(TipoValorAgregado).map((t) => (
                      <SelectItem key={t} value={t}>{(TipoValorAgregadoLabels as any)[t] ?? t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha Desde */}
              <div className="space-y-2">
                <Label className="text-brand-secondary font-medium flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Desde
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start border-brand-secondary/30",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? dateFrom.toLocaleDateString("es-CO") : "Seleccionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                  </PopoverContent>
                </Popover>
                {dateFrom && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setDateFrom(undefined)}
                  >
                    <X className="h-3 w-3 mr-1" /> Limpiar
                  </Button>
                )}
              </div>

              {/* Fecha Hasta */}
              <div className="space-y-2">
                <Label className="text-brand-secondary font-medium flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Hasta
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start border-brand-secondary/30",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? dateTo.toLocaleDateString("es-CO") : "Seleccionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} />
                  </PopoverContent>
                </Popover>
                {dateTo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setDateTo(undefined)}
                  >
                    <X className="h-3 w-3 mr-1" /> Limpiar
                  </Button>
                )}
              </div>

              {/* Botón limpiar todo */}
              <div className="lg:col-span-4 flex justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setQ("");
                    setTipoFilter(ALL);
                    setDateFrom(undefined);
                    setDateTo(undefined);
                  }}
                  className="border-brand-secondary/30"
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpiar todos los filtros
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Tabla */}
        {loading ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
              <Typography variant="body" className="text-muted">
                Cargando valores agregados...
              </Typography>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-brand-primary/10">
                <FileText className="h-8 w-8 text-brand-primary/60" />
              </div>
              <Typography variant="h3" className="text-brand-secondary">
                No hay resultados
              </Typography>
              <Typography variant="small" className="text-muted">
                No se encontraron valores agregados con los filtros aplicados
              </Typography>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="text-brand-secondary font-semibold">Fecha</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Tipo</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Título</TableHead>
                    <TableHead className="w-[180px] text-center text-brand-secondary font-semibold">Acciones</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {paginated.map((it, idx) => (
                    <TableRow
                      key={it?.id ?? `row-${idx}`}
                      className={cn(
                        "border-brand-secondary/5 transition-colors",
                        idx % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]",
                        "hover:bg-brand-primary/5"
                      )}
                    >
                      <TableCell className="font-medium text-gray-700">
                        {formatFechaCO((it as any)?.fecha) || "—"}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-xs font-medium text-brand-primary">
                          {safeTipoLabel((it as any)?.tipo)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[520px]">
                        <div className="truncate text-gray-700">{(it as any)?.titulo ?? "—"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => goDetalle(it)}
                            className="hover:bg-brand-primary/10"
                          >
                            <Eye className="h-4 w-4 text-brand-primary" />
                          </Button>
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => iniciarEditar(it)}
                              className="hover:bg-brand-primary/10"
                            >
                              <Edit className="h-4 w-4 text-brand-primary" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Paginación */}
            <div className="border-t border-brand-secondary/10 bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 px-6 py-4">
              <div className="flex items-center justify-between">
                <Typography variant="small" className="text-muted-foreground">
                  Página {page} de {totalPages} — {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
                </Typography>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1 || saving}
                    onClick={() => setPage((p) => p - 1)}
                    className="border-brand-secondary/30"
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages || saving}
                    onClick={() => setPage((p) => p + 1)}
                    className="border-brand-secondary/30"
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}