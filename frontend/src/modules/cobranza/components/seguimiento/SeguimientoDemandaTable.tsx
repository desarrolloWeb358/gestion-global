// modules/cobranza/components/SeguimientoDemandaTable.tsx
import * as React from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  Gavel,
  Save,
  Edit,
  Trash2,
  Download,
  Calendar as CalendarIcon,
  FileText,
  Filter as FilterIcon,
  Users,
  Building2,
  MapPin,
  Hash,
  Plus,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import FiltersBar from "@/shared/table-filters/FiltersBar";
import type { DateRange, FilterField } from "@/shared/table-filters/types";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/shared/ui/select";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/ui/popover";
import { db } from "@/firebase";

import {
  getSeguimientosDemanda,
  addSeguimientoDemanda,
  updateSeguimientoDemanda,
  deleteSeguimientoDemanda,
} from "@/modules/cobranza/services/seguimientoDemandaService";
import type { SeguimientoDemanda } from "@/modules/cobranza/services/seguimientoDemandaService";

import { getAuth } from "firebase/auth";
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import { PERMS, type Rol, type Perm } from "@/shared/constants/acl";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { Deudor, normalizeDemandados, type DemandadoItem } from "../../models/deudores.model";
import { ExpandableCell } from "@/shared/components/expandable-cell";
import { useUnsavedChanges } from "@/shared/hooks/useUnsavedChanges";

type SortDir = "desc" | "asc";

function toDate(v: any): Date | undefined {
  try {
    if (!v) return undefined;
    if (typeof v?.toDate === "function") return v.toDate();
    if (v instanceof Date) return v;
    if (typeof v === "number") return new Date(v);
    const t = Date.parse(v);
    return Number.isNaN(t) ? undefined : new Date(t);
  } catch {
    return undefined;
  }
}

function tsToMillis(v: any): number {
  const d = toDate(v);
  return d ? d.getTime() : 0;
}

function inRange(ms: number, range?: DateRange) {
  if (!range || (!range.from && !range.to)) return true;
  const from = range.from ? new Date(range.from.setHours(0, 0, 0, 0)).getTime() : undefined;
  const to = range.to ? new Date(range.to.setHours(23, 59, 59, 999)).getTime() : undefined;
  if (from !== undefined && ms < from) return false;
  if (to !== undefined && ms > to) return false;
  return true;
}

function toDateInputValue(anyDate: any): string {
  try {
    if (!anyDate) return "";
    if (typeof anyDate?.toDate === "function") {
      return anyDate.toDate().toISOString().slice(0, 10);
    }
    if (typeof anyDate?.seconds === "number") {
      return new Date(anyDate.seconds * 1000).toISOString().slice(0, 10);
    }
    if (anyDate instanceof Date) {
      return anyDate.toISOString().slice(0, 10);
    }
    const d = new Date(anyDate);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function parseLocalYmd(ymd: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return undefined;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatEs(dateInput: string) {
  if (!dateInput) return "—";
  const d = parseLocalYmd(dateInput) ?? new Date(dateInput);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" });
}

const fmt = new Intl.DateTimeFormat("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" });

const SeguimientoDemandaTable = React.forwardRef<any, {}>((_, ref) => {
  const { clienteId, deudorId } = useParams();
  const auth = getAuth();

  const acl = useAcl() as {
    usuario: { roles?: Rol[] } | null;
    roles: Rol[];
    perms: Set<Perm>;
    can: (req: Perm | Perm[]) => boolean;
    loading: boolean;
  };

  const roles = Array.isArray(acl.roles) ? acl.roles : [];
  const isCliente = roles.includes("cliente");
  const isDeudor = roles.includes("deudor");
  const isExterno = isCliente || isDeudor;
  const puedeEditar = acl.can(PERMS.Seguimientos_Dependientes_Edit);

  const [rows, setRows] = React.useState<SeguimientoDemanda[]>([]);
  const [loading, setLoading] = React.useState(false);

  type Filters = { fecha?: DateRange; order: SortDir };
  const [filters, setFilters] = React.useState<Filters>({ order: "desc" });
  const setFilter = (k: keyof Filters, v: any) => setFilters((s) => ({ ...s, [k]: v }));

  const fields: FilterField<SeguimientoDemanda>[] = [
    { key: "fecha", label: "Rango de fechas", kind: "daterange", getDate: (i) => toDate(i.fecha) },
  ];

  const [open, setOpen] = React.useState(false);
  const [edit, setEdit] = React.useState<SeguimientoDemanda | null>(null);
  const [fecha, setFecha] = React.useState<Date | undefined>(undefined);
  const [descripcion, setDescripcion] = React.useState("");
  const [archivo, setArchivo] = React.useState<File | undefined>(undefined);
  const [saving, setSaving] = React.useState(false);

  // Estado para observaciones del deudor
  const [deudor, setDeudor] = React.useState<Deudor | null>(null);
  const [loadingObs, setLoadingObs] = React.useState(true);
  const [obsInterna, setObsInterna] = React.useState("");
  const [obsCliente, setObsCliente] = React.useState("");
  const [savingObs, setSavingObs] = React.useState(false);

  // fechaUltimaRevision tracking (solo para actualizar si viene del seguimiento)
  const [fechaUltimaRevision, setFechaUltimaRevision] = React.useState("");

  const [esInterno, setEsInterno] = React.useState<boolean>(false);

  // Estado para información de la demanda
  const [demandados, setDemandados] = React.useState<DemandadoItem[]>([]);
  const [infoDemanda, setInfoDemanda] = React.useState({
    juzgado: "",
    numeroRadicado: "",
    localidad: "",
  });
  const [savingInfo, setSavingInfo] = React.useState(false);
  const [infoDemandaAbierta, setInfoDemandaAbierta] = React.useState(false);

  useUnsavedChanges(open);

  const resetForm = () => {
    setEdit(null);
    setFecha(undefined);
    setDescripcion("");
    setArchivo(undefined);
    setEsInterno(false);
    setSaving(false);
  };

  const loadSeguimientos = async () => {
    if (!clienteId || !deudorId) return;
    try {
      setLoading(true);
      const data = await getSeguimientosDemanda(clienteId, deudorId);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const code = e?.code || e?.message;
      toast.error(
        code === "permission-denied"
          ? "⚠️ Sin permisos para leer seguimientos (permission-denied)"
          : "⚠️ No se pudo cargar el seguimiento de la demanda"
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const loadObservaciones = async () => {
    if (!clienteId || !deudorId) return;
    try {
      setLoadingObs(true);
      const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error("El deudor no existe");
      const data = { id: deudorId, ...(snap.data() as Deudor) };
      setDeudor(data as Deudor);
      setObsInterna((data as any).observacionesDemanda ?? "");
      setObsCliente((data as any).observacionesDemandaCliente ?? "");
      setFechaUltimaRevision(toDateInputValue((data as any).fechaUltimaRevision));
      setDemandados(normalizeDemandados((data as any)?.demandados));
      setInfoDemanda({
        juzgado: (data as any)?.juzgado ?? "",
        numeroRadicado: (data as any)?.numeroRadicado ?? "",
        localidad: (data as any)?.localidad ?? "",
      });
    } catch {
      toast.error("⚠️ Error cargando observaciones");
    } finally {
      setLoadingObs(false);
    }
  };

  React.useEffect(() => {
    loadSeguimientos();
    loadObservaciones();
  }, [clienteId, deudorId]);

  React.useImperativeHandle(ref, () => ({
    openForm: () => {
      resetForm();
      setOpen(true);
    },
  }));

  const filteredSorted = React.useMemo(() => {
    const arr = rows
      .filter((r) => inRange(tsToMillis(r.fecha), filters.fecha))
      .filter((r) => (isExterno ? !(r as any).esInterno : true));

    const dir = filters.order === "desc" ? -1 : 1;
    return arr.sort((a, b) => (tsToMillis(a.fecha) - tsToMillis(b.fecha)) * dir);
  }, [rows, filters.fecha, filters.order, isExterno]);

  const openNew = () => { resetForm(); setOpen(true); };

  const openEdit = (row: SeguimientoDemanda) => {
    if (!puedeEditar) {
      toast.error("No tienes permiso para editar.");
      return;
    }
    setEdit(row);
    setFecha(toDate(row.fecha));
    setDescripcion(row.descripcion ?? "");
    setEsInterno(!!(row as any).esInterno);
    setArchivo(undefined);
    setOpen(true);
  };

  const saveSeguimiento = async () => {
    if (!puedeEditar) {
      toast.error("No tienes permiso para crear/editar seguimientos de demanda.");
      return;
    }
    if (!clienteId || !deudorId) return;
    if (saving) return;
    if (!fecha) {
      toast.error("La fecha es obligatoria");
      return;
    }

    const payload = {
      fecha,
      descripcion: (descripcion || "").trim(),
      esInterno,
    };

    try {
      setSaving(true);
      if (edit?.id) {
        await updateSeguimientoDemanda(clienteId, deudorId, edit.id, payload, archivo);
        toast.success("✓ Seguimiento actualizado correctamente");
      } else {
        const uidUsuario = auth.currentUser?.uid;
        if (!uidUsuario) {
          toast.error("No se pudo obtener el usuario autenticado");
          return;
        }
        await addSeguimientoDemanda(uidUsuario, clienteId, deudorId, payload, archivo);

        if (!esInterno && fecha) {
          const newDateStr = toDateInputValue(fecha);
          if (!fechaUltimaRevision || newDateStr > fechaUltimaRevision) {
            const deudorRef = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
            await updateDoc(deudorRef, {
              fechaUltimaRevision: parseLocalYmd(newDateStr) ?? fecha,
            });
            setFechaUltimaRevision(newDateStr);
          }
        }

        toast.success("✓ Seguimiento creado correctamente");
      }
      setOpen(false);
      resetForm();
      await loadSeguimientos();
    } catch (e) {
      console.error(e);
      toast.error("⚠️ No se pudo guardar el seguimiento");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!puedeEditar) {
      toast.error("No tienes permiso para eliminar seguimientos de demanda.");
      return;
    }
    if (!clienteId || !deudorId) return;
    if (!window.confirm("¿Estás seguro de eliminar este registro?")) return;

    try {
      await deleteSeguimientoDemanda(clienteId, deudorId, id);
      toast.success("✓ Registro eliminado");
      setRows((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
      toast.error("⚠️ No se pudo eliminar el registro");
    }
  };

  const handleGuardarObservaciones = async () => {
    if (!clienteId || !deudorId || !puedeEditar) return;
    try {
      setSavingObs(true);
      const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
      const payload: Record<string, any> = {
        observacionesDemanda: obsInterna || "",
        observacionesDemandaCliente: obsCliente || "",
      };
      const prevObsCliente = (deudor as any)?.observacionesDemandaCliente ?? "";
      if ((obsCliente || "") !== (prevObsCliente || "")) {
        payload.observacionesDemandaClienteFecha = serverTimestamp();
      }
      await updateDoc(ref, payload);
      setDeudor((prev) => (prev ? ({ ...prev, ...payload } as Deudor) : prev));
      toast.success("✓ Observaciones guardadas correctamente");
    } catch {
      toast.error("⚠️ No se pudo guardar las observaciones");
    } finally {
      setSavingObs(false);
    }
  };

  const addDemandado = () =>
    setDemandados((prev) => [...prev, { nombre: "", numeroDocumento: "" }]);

  const removeDemandado = (idx: number) =>
    setDemandados((prev) => prev.filter((_, i) => i !== idx));

  const updateDemandadoField = (idx: number, field: keyof DemandadoItem, value: string) =>
    setDemandados((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );

  const handleGuardarInfoDemanda = async () => {
    if (!clienteId || !deudorId || !puedeEditar) return;
    try {
      setSavingInfo(true);
      const deudorRef = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
      const demandadosLimpios = demandados.filter((d) => d.nombre.trim());
      const payload: Record<string, any> = {
        demandados: demandadosLimpios,
        juzgado: infoDemanda.juzgado || "",
        numeroRadicado: infoDemanda.numeroRadicado || "",
        localidad: infoDemanda.localidad || "",
        fechaActualizacion: serverTimestamp(),
      };
      if (fechaUltimaRevision) {
        payload.fechaUltimaRevision =
          parseLocalYmd(fechaUltimaRevision) ?? new Date(fechaUltimaRevision);
      } else {
        payload.fechaUltimaRevision = null;
      }
      await updateDoc(deudorRef, payload);
      toast.success("✓ Información de la demanda guardada");
    } catch {
      toast.error("⚠️ No se pudo guardar la información");
    } finally {
      setSavingInfo(false);
    }
  };

  return (
    <div className="space-y-4">
      {(savingObs || savingInfo) && (
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="rounded-xl bg-white shadow-lg px-6 py-5 flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
            <Typography variant="body" className="font-medium">
              Guardando cambios...
            </Typography>
          </div>
        </div>
      )}

      {/* Información de la demanda */}
      {!loadingObs && puedeEditar && (
        <section className="rounded-2xl border border-red-200 bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setInfoDemandaAbierta((v) => !v)}
            className="w-full bg-gradient-to-r from-red-50 to-orange-50 p-4 md:p-5 flex items-center justify-between hover:from-red-100 hover:to-orange-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-red-600" />
              <Typography variant="h3" className="!text-red-700 font-semibold">
                Datos de la demanda
              </Typography>
            </div>
            <ChevronDown
              className={cn(
                "h-5 w-5 text-red-600 transition-transform duration-200",
                infoDemandaAbierta && "rotate-180"
              )}
            />
          </button>

          {infoDemandaAbierta && (
          <div className="p-4 md:p-5 space-y-6">
            {/* Lista de demandados */}
            <div className="space-y-3">
              <Label className="text-brand-secondary font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Demandados
              </Label>

              {demandados.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  Agrega al menos un demandado.
                </p>
              )}

              <div className="space-y-2">
                {demandados.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-3 rounded-lg border border-brand-secondary/15 bg-brand-primary/[0.02]"
                  >
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Nombre completo</p>
                        <Input
                          placeholder="Ej: Juan Pérez Gómez"
                          value={item.nombre}
                          onChange={(e) => updateDemandadoField(idx, "nombre", e.target.value)}
                          className="border-brand-secondary/30"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Número de documento</p>
                        <Input
                          placeholder="Ej: 12345678"
                          value={item.numeroDocumento}
                          onChange={(e) => updateDemandadoField(idx, "numeroDocumento", e.target.value)}
                          className="border-brand-secondary/30"
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDemandado(idx)}
                      className="hover:bg-red-50 mt-5 shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={addDemandado}
                className="gap-2 border-brand-secondary/30 mt-1"
              >
                <Plus className="h-4 w-4" />
                Agregar demandado
              </Button>
            </div>

            {/* Campos juzgado, radicado, localidad, fecha revisión */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-brand-secondary font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Juzgado
                </Label>
                <Input
                  value={infoDemanda.juzgado}
                  onChange={(e) => setInfoDemanda((s) => ({ ...s, juzgado: e.target.value }))}
                  className="border-brand-secondary/30"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-brand-secondary font-medium flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Número de radicado
                </Label>
                <Input
                  value={infoDemanda.numeroRadicado}
                  onChange={(e) => setInfoDemanda((s) => ({ ...s, numeroRadicado: e.target.value }))}
                  className="border-brand-secondary/30"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-brand-secondary font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Localidad
                </Label>
                <Input
                  value={infoDemanda.localidad}
                  onChange={(e) => setInfoDemanda((s) => ({ ...s, localidad: e.target.value }))}
                  className="border-brand-secondary/30"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-brand-secondary font-medium flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Fecha última revisión
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal border-brand-secondary/30",
                        !fechaUltimaRevision && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fechaUltimaRevision ? formatEs(fechaUltimaRevision) : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fechaUltimaRevision ? parseLocalYmd(fechaUltimaRevision) : undefined}
                      onSelect={(d) => setFechaUltimaRevision(d ? d.toISOString().slice(0, 10) : "")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleGuardarInfoDemanda}
                disabled={savingInfo}
                variant="brand"
                className="gap-2 shadow-md hover:shadow-lg transition-all"
              >
                <Save className="h-4 w-4" />
                {savingInfo ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </div>
          )}
        </section>
      )}

      {/* Filtros */}
      <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FilterIcon className="h-5 w-5 text-brand-primary" />
              <Typography variant="h3" className="!text-brand-secondary font-semibold">
                Filtros y ordenamiento
              </Typography>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Ordenar:</span>
              <Select
                value={filters.order}
                onValueChange={(v) => setFilter("order", (v as SortDir) || "desc")}
              >
                <SelectTrigger className="w-[220px] border-brand-secondary/30">
                  <SelectValue placeholder="Orden" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Más reciente primero</SelectItem>
                  <SelectItem value="asc">Más antigua primero</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="p-4 md:p-5">
          <FiltersBar
            fields={fields}
            filtersState={filters as Record<string, any>}
            setFilter={(k, v) => setFilter(k as keyof Filters, v)}
            onReset={() => setFilters({ order: "desc", fecha: undefined })}
          />
        </div>
      </section>

      {/* Tabla */}
      {loading ? (
        <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
            <Typography variant="body">Cargando registros...</Typography>
          </div>
        </div>
      ) : filteredSorted.length === 0 ? (
        <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 rounded-full bg-brand-primary/10">
              <Gavel className="h-8 w-8 text-brand-primary/60" />
            </div>
            <Typography variant="h3" className="text-brand-secondary">
              No hay registros
            </Typography>
            <Typography variant="small">
              Aún no se han registrado seguimientos de demanda
            </Typography>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                  <TableHead className="w-[140px] text-brand-secondary font-semibold">Fecha</TableHead>
                  <TableHead className="text-brand-secondary font-semibold">Descripción</TableHead>
                  {!isExterno && (
                    <TableHead className="w-[110px] text-brand-secondary font-semibold text-center">
                      Interno
                    </TableHead>
                  )}
                  <TableHead className="w-[120px] text-brand-secondary font-semibold">Archivo</TableHead>
                  {puedeEditar && (
                    <TableHead className="w-[180px] text-center text-brand-secondary font-semibold">
                      Acciones
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSorted.map((row, index) => {
                  const d = toDate(row.fecha);
                  const fechaStr = d ? fmt.format(d) : "—";
                  const interno = !!(row as any).esInterno;
                  return (
                    <TableRow
                      key={row.id}
                      className={cn(
                        "border-brand-secondary/5 transition-colors",
                        index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]",
                        "hover:bg-brand-primary/5"
                      )}
                    >
                      <TableCell className="text-gray-700 font-medium">{fechaStr}</TableCell>
                      <TableCell>
                        <ExpandableCell text={row.descripcion} />
                      </TableCell>
                      {!isExterno && (
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                              interno ? "bg-orange-100 text-orange-900" : "bg-gray-100 text-gray-700"
                            )}
                          >
                            {interno ? "Sí" : "No"}
                          </span>
                        </TableCell>
                      )}
                      <TableCell>
                        {row.archivoUrl ? (
                          <a
                            href={row.archivoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-brand-primary hover:text-brand-secondary transition-colors text-sm font-medium"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Ver
                          </a>
                        ) : (
                          <span className="text-sm">—</span>
                        )}
                      </TableCell>
                      {puedeEditar && (
                        <TableCell>
                          <div className="flex justify-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEdit(row)}
                              className="hover:bg-brand-primary/10"
                            >
                              <Edit className="h-4 w-4 text-brand-primary" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => remove(row.id!)}
                              className="hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Observaciones internas */}
      {!loadingObs && !isExterno && (
        <section className="rounded-2xl border border-orange-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-orange-50 to-orange-100/50 p-4 md:p-5 border-b border-orange-200/50">
            <Typography variant="h3" className="!text-orange-900 font-semibold">
              Observaciones internas
            </Typography>
          </div>
          <div className="p-4 md:p-5">
            <Textarea
              value={obsInterna}
              onChange={(e) => setObsInterna(e.target.value)}
              readOnly={!puedeEditar}
              className="min-h-36 border-brand-secondary/30"
            />
          </div>
        </section>
      )}

      {/* Observaciones del conjunto */}
      {!loadingObs && (
        <section className="rounded-2xl border border-green-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-green-50 to-green-100/50 p-4 md:p-5 border-b border-green-200/50">
            <Typography variant="h3" className="!text-green-900 font-semibold">
              Observaciones del conjunto
            </Typography>
          </div>
          <div className="p-4 md:p-5 space-y-3">
            <Textarea
              value={obsCliente}
              onChange={(e) => setObsCliente(e.target.value)}
              readOnly={!puedeEditar}
              className="min-h-36 border-brand-secondary/30"
              placeholder={puedeEditar ? "Escribe tu observación..." : ""}
            />
            <div className="text-right">
              <span className="text-xs text-muted-foreground">
                {(() => {
                  const ts = (deudor as any)?.observacionesDemandaClienteFecha;
                  const d = ts && typeof ts.toDate === "function" ? ts.toDate() : null;
                  return d ? `Última actualización: ${d.toLocaleString("es-CO", { hour12: false })}` : "";
                })()}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Botón guardar observaciones */}
      {!loadingObs && puedeEditar && (
        <div className="flex justify-end">
          <Button
            onClick={handleGuardarObservaciones}
            disabled={savingObs}
            variant="brand"
            className="gap-2 shadow-md hover:shadow-lg transition-all"
          >
            <Save className="h-4 w-4" />
            {savingObs ? "Guardando..." : "Guardar observaciones"}
          </Button>
        </div>
      )}

      {/* Dialog Form Seguimiento */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-brand-primary text-xl font-bold flex items-center gap-2">
              <Gavel className="h-5 w-5" />
              {edit ? "Editar registro" : "Nuevo registro"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-brand-secondary font-medium">Fecha *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal border-brand-secondary/30",
                        !fecha && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fecha ? formatEs(fecha.toISOString().slice(0, 10)) : "Seleccionar fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fecha}
                      onSelect={setFecha}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-brand-secondary font-medium">¿Es interno?</Label>
              <Select
                value={esInterno ? "si" : "no"}
                onValueChange={(v) => setEsInterno(v === "si")}
              >
                <SelectTrigger className="w-full border-brand-secondary/30">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="si">Sí</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Interno: visible para el equipo (no para cliente).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion" className="text-brand-secondary font-medium">
                Descripción
              </Label>
              <Textarea
                id="descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Describe el seguimiento realizado..."
                className="min-h-32 border-brand-secondary/30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="archivo" className="text-brand-secondary font-medium">
                Archivo adjunto
              </Label>
              <Input
                id="archivo"
                type="file"
                onChange={(e) => setArchivo(e.target.files?.[0])}
                className="border-brand-secondary/30"
              />
              {edit?.archivoUrl && !archivo && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <a
                    href={edit.archivoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-primary hover:underline"
                  >
                    Ver archivo actual
                  </a>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setOpen(false); resetForm(); }}
              disabled={saving}
              className="border-brand-secondary/30"
            >
              Cancelar
            </Button>
            {puedeEditar && (
              <Button
                onClick={saveSeguimiento}
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
                    <Save className="h-4 w-4" />
                    Guardar
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

SeguimientoDemandaTable.displayName = "SeguimientoDemandaTable";

export default SeguimientoDemandaTable;
