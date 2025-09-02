import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Eye, Pencil, Trash2, Upload, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { Calendar } from "../../../components/ui/calendar";

import { ValorAgregado } from "../models/valorAgregado.model";
import {
  listarValoresAgregados,
  crearValorAgregado,
  actualizarValorAgregado,
  eliminarValorAgregado,
  formatFechaCO,
} from "../services/valorAgregadoService";
import { TipoValorAgregado, TipoValorAgregadoLabels } from "../../../shared/constants/tipoValorAgregado";

export default function ValoresAgregadosTable() {
  const navigate = useNavigate();
  const { clienteId } = useParams<{ clienteId: string }>();

  // Estado general
  const [items, setItems] = useState<ValorAgregado[]>([]);
  const [loading, setLoading] = useState(false);

  // Dialog crear/editar
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<ValorAgregado | null>(null);
  const [formData, setFormData] = useState<Partial<ValorAgregado>>({});
  const [archivoFile, setArchivoFile] = useState<File | undefined>(undefined);

  // Fecha con calendario (guardada como Timestamp en el service)
  const [fecha, setFecha] = useState<Date | undefined>();

  // Eliminar
  const [openEliminar, setOpenEliminar] = useState(false);
  const [seleccionado, setSeleccionado] = useState<ValorAgregado | null>(null);

  // Búsqueda y paginación
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;

  // --- NUEVO: flag de guardado para bloquear UI y evitar doble submit ---
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!clienteId) return;
    setLoading(true);
    try {
      const data = await listarValoresAgregados(clienteId);
      setItems(data);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los valores agregados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        (it.titulo ?? "").toLowerCase().includes(q) ||
        (it.observaciones ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // --- Handlers ---
  const iniciarCrear = () => {
    setEditando(null);
    setFormData({
      tipo: TipoValorAgregado.DERECHO_DE_PETICION,
      titulo: "",
      observaciones: "",
    });
    setArchivoFile(undefined);
    setFecha(undefined);
    setOpen(true);
  };

  const iniciarEditar = (it: ValorAgregado) => {
    setEditando(it);
    setFormData({ ...it });
    if (it.fecha && "toDate" in (it.fecha as any)) {
      setFecha((it.fecha as any).toDate());
    } else {
      setFecha(undefined);
    }
    setArchivoFile(undefined);
    setOpen(true);
  };

  const onSubmit = async () => {
    if (!clienteId) return;
    // --- NUEVO: cortar si ya está guardando ---
    if (saving) return;

    setSaving(true);
    try {
      const fechaTs = fecha ? Timestamp.fromDate(fecha) : undefined;

      if (editando) {
        await actualizarValorAgregado(
          clienteId,
          editando.id!,
          {
            tipo: formData.tipo as TipoValorAgregado,
            titulo: String(formData.titulo ?? ""),
            observaciones: String(formData.observaciones ?? ""),
            fechaTs, // <-- Timestamp a Firestore
          },
          archivoFile
        );
        toast.success("Valor agregado actualizado");
      } else {
        await crearValorAgregado(
          clienteId,
          {
            tipo: (formData.tipo as TipoValorAgregado) ?? TipoValorAgregado.DERECHO_DE_PETICION,
            titulo: String(formData.titulo ?? ""),
            observaciones: String(formData.observaciones ?? ""),
            fechaTs, // <-- Timestamp a Firestore
          },
          archivoFile
        );
        toast.success("Valor agregado creado");
      }

      // Cierra el modal y recarga la tabla ANTES de quitar el bloqueo
      setOpen(false);
      await fetchData();
    } catch (e) {
      console.error(e);
      toast.error("Error guardando el valor agregado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Overlay global durante guardado para bloquear pantalla */}
      {saving && (
        <div className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm grid place-items-center">
          <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-lg">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Guardando…</span>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center gap-2">
        <h2 className="text-xl font-semibold">Valores agregados</h2>

        <Input
          placeholder="Buscar por título u observaciones"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-md"
          disabled={saving}
        />

        <Dialog
          open={open}
          // --- NUEVO: no permitir cerrar el dialog mientras guarda ---
          onOpenChange={(v) => {
            if (saving) return;
            setOpen(v);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={iniciarCrear} disabled={saving}>
              Crear valor agregado
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editando ? "Editar valor agregado" : "Crear valor agregado"}</DialogTitle>
            </DialogHeader>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
              }}
            >
              <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-2">
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={(formData.tipo as TipoValorAgregado) ?? TipoValorAgregado.DERECHO_DE_PETICION}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, tipo: val as TipoValorAgregado }))}
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(TipoValorAgregado).map((t) => (
                        <SelectItem key={t} value={t}>
                          {TipoValorAgregadoLabels[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Fecha con calendario (Popover + Calendar) */}
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

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label>Título</Label>
                  <Input
                    value={formData.titulo ?? ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, titulo: e.target.value }))}
                    disabled={saving}
                  />
                </div>

                <div>
                  <Label>Observaciones</Label>
                  <Input
                    value={formData.observaciones ?? ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, observaciones: e.target.value }))}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label>Archivo (Word, PDF, Excel)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => setArchivoFile(e.target.files?.[0])}
                      disabled={saving}
                    />
                    <Upload className="w-4 h-4" />
                  </div>
                  {editando?.archivoNombre && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Actual: {editando.archivoNombre}
                    </p>
                  )}
                </div>
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
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-6">Cargando...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((it) => (
              <TableRow key={it.id}>
                <TableCell>{formatFechaCO(it.fecha as any) || "—"}</TableCell>
                <TableCell>{TipoValorAgregadoLabels[it.tipo]}</TableCell>
                <TableCell>{it.titulo}</TableCell>

                <TableCell className="text-center">
                  <TooltipProvider>
                    <div className="flex justify-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => navigate(`/clientes/${clienteId}/valores-agregados/${it.id}`)}
                            disabled={saving}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ver detalle</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" onClick={() => iniciarEditar(it)} disabled={saving}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => {
                              setSeleccionado(it);
                              setOpenEliminar(true);
                            }}
                            disabled={saving}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Eliminar</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Diálogo de confirmación para eliminar */}
      <Dialog open={openEliminar} onOpenChange={setOpenEliminar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar valor agregado?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer.</p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpenEliminar(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (seleccionado && clienteId) {
                  // Opcional: podrías tener un flag separado 'deleting'
                  setSaving(true);
                  try {
                    await eliminarValorAgregado(clienteId, seleccionado.id!);
                    setOpenEliminar(false);
                    await fetchData();
                  } catch (e) {
                    console.error(e);
                    toast.error("Error eliminando el valor agregado");
                  } finally {
                    setSaving(false);
                  }
                }
              }}
              disabled={saving}
            >
              {saving ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Eliminando…
                </span>
              ) : (
                "Eliminar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paginación */}
      <div className="flex justify-between items-center pt-4">
        <p className="text-sm text-muted-foreground">
          Página {page} de {totalPages}
        </p>
        <div className="space-x-2">
          <Button variant="outline" disabled={page === 1 || saving} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <Button variant="outline" disabled={page === totalPages || saving} onClick={() => setPage((p) => p + 1)}>
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
