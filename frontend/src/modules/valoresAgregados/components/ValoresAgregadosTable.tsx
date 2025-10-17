// src/modules/cobranza/components/ValoresAgregadosTable.tsx
"use client";

import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Calendar as CalendarIcon, X } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/ui/select";
import { Label } from "@/shared/ui/label";

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
        <div className="p-3 rounded-md border border-red-300 bg-red-50 text-red-700 text-sm">
          <div className="font-semibold">Ocurrió un error cargando los valores agregados.</div>
          {this.state.message && <div className="mt-1">Detalle: {this.state.message}</div>}
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

// ⭐ Sentinela para "Todos" (evita value="")
const ALL = "__ALL__";

// =======================
// Componente principal
// =======================
export default function ValoresAgregadosTable() {
  const navigate = useNavigate();
  const { clienteId } = useParams<{ clienteId: string }>();

  const { can, roles = [], loading: aclLoading } = useAcl();
  const canView = can(PERMS.Valores_Read);
  const canEdit = canView && !roles.includes("cliente"); // cliente solo lectura

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
  const itemsPerPage = 5;

  // ===== Filtros simples
  const [q, setQ] = React.useState("");
  const [tipoFilter, setTipoFilter] = React.useState<string>(ALL); // ✅ sentinela
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
      toast.error("No se pudieron cargar los valores agregados");
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
      // ✅ aplicar tipo solo si NO es "Todos"
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
        toast.success("Valor agregado actualizado");
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
        toast.success("Valor agregado creado");
      }

      setOpen(false);
      await fetchData();
      setArchivoFile(undefined);
    } catch (e) {
      console.error(e);
      toast.error("Error guardando el valor agregado");
    } finally {
      setSaving(false);
    }
  };

  // =======================
  // Render
  // =======================
  if (aclLoading) {
    return <p className="p-4 text-sm">Cargando permisos…</p>;
  }
  if (!canView) {
    return <p className="p-4 text-sm">No tienes acceso a Valores agregados.</p>;
  }

  return (
    <ErrorBoundary>
      <div className="space-y-4 relative">
        {/* Overlay guardando */}
        {saving && (
          <div className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm grid place-items-center pointer-events-auto">
            <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-lg">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Guardando…</span>
            </div>
          </div>
        )}

        {/* Encabezado + botón crear */}
        <div className="flex justify-between items-center gap-2">
          <h2 className="text-xl font-semibold">Valores agregados</h2>

          {canEdit && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={iniciarCrear} disabled={saving}>Crear valor agregado</Button>
              </DialogTrigger>

              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editando ? "Editar valor agregado" : "Crear valor agregado"}</DialogTitle>
                </DialogHeader>

                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t mt-2">
                    <div>
                      <Label>Tipo</Label>
                      <Select
                        value={(formData.tipo as TipoValorAgregado) ?? TipoValorAgregado.DERECHO_DE_PETICION}
                        onValueChange={(val) => setFormData((prev) => ({ ...prev, tipo: val as TipoValorAgregado }))}
                        disabled={saving}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                        <SelectContent>
                          {Object.values(TipoValorAgregado).map((t) => (
                            <SelectItem key={t} value={t}>{TipoValorAgregadoLabels[t]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Fecha</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-start text-left font-normal"
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

                  <div>
                    <Label>Título</Label>
                    <Input
                      value={formData.titulo ?? ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, titulo: e.target.value }))}
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <Label>Descripción</Label>
                    <Textarea
                      value={formData.descripcion ?? ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, descripcion: e.target.value }))}
                      disabled={saving}
                      placeholder="Anota contexto, acuerdos, radicados, notas internas…"
                      className="min-h-40 max-h-80 overflow-y-auto resize-y"
                      maxLength={1000}
                    />
                  </div>

                  {/* Archivo adjunto */}
                  <div className="space-y-2">
                    <Label>Archivo adjunto</Label>

                    {editando && (editando.archivoNombre || editando.archivoPath || editando.archivoURL) && !archivoFile && (
                      <div className="text-xs text-muted-foreground">
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
                            toast.error(`El archivo supera {MAX_FILE_MB} MB`);
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
                      >
                        Seleccionar archivo
                      </Button>

                      {archivoFile ? (
                        <div className="text-sm">
                          <span className="font-medium">{archivoFile.name}</span>{" "}
                          <span className="text-muted-foreground">({formatBytes(archivoFile.size)})</span>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No hay archivo seleccionado</div>
                      )}

                      {archivoFile && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => setArchivoFile(undefined)}
                          disabled={saving}
                        >
                          Quitar
                        </Button>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Formatos permitidos: PDF, Word, Excel, JPG/PNG. Tamaño máximo: {MAX_FILE_MB} MB.
                    </p>
                  </div>

                  <div className="pt-6">
                    <Button type="submit" className="w-full" disabled={saving}>
                      {saving ? (
                        <span className="inline-flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Guardando…
                        </span>
                      ) : (
                        "Guardar"
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* ====== Filtros simples ====== */}
        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
          <div className="md:col-span-2">
            <Label>Búsqueda</Label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por título o descripción…"
            />
          </div>

          <div>
            <Label>Tipo</Label>
            <Select
              value={tipoFilter}
              onValueChange={(v) => setTipoFilter(v)}
            >
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                {/* ✅ usar sentinela, NO "" */}
                <SelectItem value={ALL}>Todos</SelectItem>
                {Object.values(TipoValorAgregado).map((t) => (
                  <SelectItem key={t} value={t}>{(TipoValorAgregadoLabels as any)[t] ?? t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label>Desde</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? dateFrom.toLocaleDateString("es-CO") : "—"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
              </PopoverContent>
            </Popover>
            {dateFrom && (
              <Button variant="ghost" size="sm" className="justify-start px-2" onClick={() => setDateFrom(undefined)}>
                <X className="h-4 w-4 mr-1" /> Limpiar
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label>Hasta</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? dateTo.toLocaleDateString("es-CO") : "—"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} />
              </PopoverContent>
            </Popover>
            {dateTo && (
              <Button variant="ghost" size="sm" className="justify-start px-2" onClick={() => setDateTo(undefined)}>
                <X className="h-4 w-4 mr-1" /> Limpiar
              </Button>
            )}
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setQ("");
                setTipoFilter(ALL);   // ✅ reset al sentinela
                setDateFrom(undefined);
                setDateTo(undefined);
              }}
            >
              Limpiar filtros
            </Button>
          </div>
        </div>

        {/* Listado */}
        {loading ? (
          <p className="text-muted-foreground text-center py-6">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">No hay resultados para los filtros aplicados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="w-[180px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {paginated.map((it, idx) => (
                <TableRow key={it?.id ?? `row-${idx}`}>
                  <TableCell>{formatFechaCO((it as any)?.fecha) || "—"}</TableCell>
                  <TableCell>{safeTipoLabel((it as any)?.tipo)}</TableCell>
                  <TableCell className="max-w-[520px] truncate">{(it as any)?.titulo ?? "—"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => goDetalle(it)}>
                      Ver
                    </Button>
                    {canEdit && (
                      <Button variant="outline" size="sm" onClick={() => iniciarEditar(it)}>
                        Editar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Paginación */}
        <div className="flex justify-between items-center pt-4">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages} — {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
          </p>
          <div className="space-x-2">
            <Button variant="outline" disabled={page === 1 || saving} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button variant="outline" disabled={page === totalPages || saving} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
