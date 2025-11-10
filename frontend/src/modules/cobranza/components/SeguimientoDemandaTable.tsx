// modules/cobranza/components/SeguimientoDemandaTable.tsx
import * as React from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/card";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/shared/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import FiltersBar from "@/shared/table-filters/FiltersBar";
import type { DateRange, FilterField } from "@/shared/table-filters/types";
import {
  getSeguimientosDemanda,
  addSeguimientoDemanda,
  updateSeguimientoDemanda,
  deleteSeguimientoDemanda,
} from "@/modules/cobranza/services/seguimientoDemandaService";
import type { SeguimientoDemanda } from "@/modules/cobranza/services/seguimientoDemandaService";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/shared/ui/select";

// Calendar (ShadCN)
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/ui/popover";
import { Loader2 } from "lucide-react";
import { getAuth } from "firebase/auth";

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
const fmt = new Intl.DateTimeFormat("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" });

export default function SeguimientoDemandaTable() {
  const { clienteId, deudorId } = useParams();

  const [rows, setRows] = React.useState<SeguimientoDemanda[]>([]);
  const [loading, setLoading] = React.useState(false);

  // filtros
  type Filters = { fecha?: DateRange; order: SortDir };
  const [filters, setFilters] = React.useState<Filters>({ order: "desc" });
  const setFilter = (k: keyof Filters, v: any) => setFilters((s) => ({ ...s, [k]: v }));

  const fields: FilterField<SeguimientoDemanda>[] = [
    { key: "fecha", label: "Rango de fechas", kind: "daterange", getDate: (i) => toDate(i.fecha) },
  ];

  // modal form
  const [open, setOpen] = React.useState(false);
  const [edit, setEdit] = React.useState<SeguimientoDemanda | null>(null);
  const [consecutivo, setConsecutivo] = React.useState("");
  const [fecha, setFecha] = React.useState<Date | undefined>(undefined);
  const [descripcion, setDescripcion] = React.useState("");
  const [archivo, setArchivo] = React.useState<File | undefined>(undefined);
  const [saving, setSaving] = React.useState(false);

  const auth = getAuth();

  const resetForm = () => {
    setEdit(null);
    setConsecutivo("");
    setFecha(undefined);
    setDescripcion("");
    setArchivo(undefined);
    setSaving(false);
  };

  const load = async () => {
    if (!clienteId || !deudorId) return;
    try {
      setLoading(true);
      const data = await getSeguimientosDemanda(clienteId, deudorId);
      setRows(data);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar el seguimiento de la demanda.");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { load(); }, [clienteId, deudorId]);

  const filteredSorted = React.useMemo(() => {
    const arr = rows.filter((r) => inRange(tsToMillis(r.fecha), filters.fecha));
    const dir = filters.order === "desc" ? -1 : 1;
    return arr.sort((a, b) => (tsToMillis(a.fecha) - tsToMillis(b.fecha)) * dir);
  }, [rows, filters]);

  const openNew = () => { resetForm(); setOpen(true); };
  const openEdit = (row: SeguimientoDemanda) => {
    setEdit(row);
    setConsecutivo(row.consecutivo ?? "");
    setFecha(toDate(row.fecha));
    setDescripcion(row.descripcion ?? "");
    setArchivo(undefined);
    setOpen(true);
  };

  const save = async () => {
    if (!clienteId || !deudorId) return;
    if (saving) return; // evita doble clic
    if (!consecutivo.trim()) return toast.error("Consecutivo es obligatorio.");
    if (!fecha) return toast.error("Fecha es obligatoria.");

    const payload = {
      consecutivo: consecutivo.trim(),
      fecha,
      descripcion: (descripcion || "").trim(),
    };

    try {
      setSaving(true);
      if (edit?.id) {
        await updateSeguimientoDemanda(clienteId, deudorId, edit.id, payload, archivo);
        toast.success("Seguimiento de demanda actualizado.");
      } else {
        const uidUsuario = auth.currentUser?.uid;
        if (!uidUsuario) {
          toast.error("No se pudo obtener el usuario autenticado.");
          return;
        }
        await addSeguimientoDemanda(uidUsuario, clienteId, deudorId, payload, archivo);
        toast.success("Seguimiento de demanda creado.");
      }
      setOpen(false);
      resetForm();
      await load();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!clienteId || !deudorId) return;
    try {
      await deleteSeguimientoDemanda(clienteId, deudorId, id);
      toast.success("Eliminado.");
      setRows((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      console.error(e);
      toast.error("No se pudo eliminar.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Seguimiento de la Demanda</h2>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Ordenar:</span>
          <Select value={filters.order} onValueChange={(v) => setFilter("order", (v as SortDir) || "desc")}>
            <SelectTrigger className="w-[240px]"><SelectValue placeholder="Orden" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Más reciente → más antigua</SelectItem>
              <SelectItem value="asc">Más antigua → más reciente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={openNew}>Nuevo registro</Button>
      </div>

      <FiltersBar
        fields={fields}
        filtersState={filters as Record<string, any>}
        setFilter={(k, v) => setFilter(k as keyof Filters, v)}
        onReset={() => setFilters({ order: "desc", fecha: undefined })}
      />

      <Card>
        <CardHeader>
          <CardTitle>Registros</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : filteredSorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay registros.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Consecutivo</TableHead>
                  <TableHead className="w-[160px]">Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-[140px]">Archivo</TableHead>
                  <TableHead className="w-[160px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSorted.map((row) => {
                  const d = toDate(row.fecha);
                  const fechaStr = d ? fmt.format(d) : "—";
                  return (
                    <TableRow key={row.id}>
                      <TableCell>{row.consecutivo || "—"}</TableCell>
                      <TableCell>{fechaStr}</TableCell>
                      <TableCell>
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {row.descripcion || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.archivoUrl ? (
                          <a href={row.archivoUrl} target="_blank" rel="noreferrer" className="underline text-sm">
                            Ver archivo
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(row)}>Editar</Button>
                        <Button size="sm" variant="destructive" onClick={() => remove(row.id!)}>Eliminar</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Form dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit ? "Editar registro" : "Nuevo registro"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Consecutivo</label>
                <Input value={consecutivo} onChange={(e) => setConsecutivo(e.target.value)} placeholder="Ej. 001-2025" />
              </div>

              {/* Fecha con Calendar */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Fecha</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-start">
                      {fecha ? fmt.format(fecha) : "Selecciona una fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" align="start">
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

            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4} />
            </div>

            <div>
              <label className="text-sm font-medium">Archivo (opcional)</label>
              <Input type="file" onChange={(e) => setArchivo(e.target.files?.[0])} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving} aria-busy={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {edit ? "Guardando..." : "Creando..."}
                </>
              ) : (
                edit ? "Guardar cambios" : "Crear"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
