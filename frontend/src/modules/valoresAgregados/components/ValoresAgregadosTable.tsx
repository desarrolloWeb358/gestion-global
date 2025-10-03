// src/modules/cobranza/components/ValoresAgregadosTable.tsx
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent,  DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";

import { ValorAgregado } from "../models/valorAgregado.model";
import { listarValoresAgregados, crearValorAgregado, actualizarValorAgregado, formatFechaCO, } from "../services/valorAgregadoService";
import { TipoValorAgregado, TipoValorAgregadoLabels } from "../../../shared/constants/tipoValorAgregado";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/ui/select";
import { Label } from "recharts";

// ErrorBoundary
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Error capturado en ValoresAgregadosTable:", error);
  }

  render() {
    if (this.state.hasError) {
      return <p className="text-red-600">Ocurrió un error cargando los valores agregados.</p>;
    }
    return this.props.children;
  }
}

export default function ValoresAgregadosTable() {
  const navigate = useNavigate();
  const { clienteId } = useParams<{ clienteId: string }>();
  const { can, roles = [], loading: aclLoading } = useAcl();
  const canEdit = can(PERMS.Valores_Read) && !roles.includes("cliente"); // cliente solo lectura
  const canView = can(PERMS.Valores_Read);

  const [items, setItems] = useState<ValorAgregado[]>([]);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<ValorAgregado | null>(null);
  const [formData, setFormData] = useState<Partial<ValorAgregado>>({});
  const [archivoFile, setArchivoFile] = useState<File | undefined>(undefined);
  const [fecha, setFecha] = useState<Date | undefined>();

  const [openEliminar, setOpenEliminar] = useState(false);
  const [seleccionado, setSeleccionado] = useState<ValorAgregado | null>(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;

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
    if (!canView) return;
    fetchData();
  }, [clienteId, canView]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        (it.titulo ?? "").toLowerCase().includes(q) ||
        (it.descripcion ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

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
    setEditando(it);
    setFormData({ ...it });
    setFecha(it.fecha && "toDate" in it.fecha ? (it.fecha as any).toDate() : undefined);
    setArchivoFile(undefined);
    setOpen(true);
  };

  const onSubmit = async () => {
    if (!clienteId || saving || !canEdit) return;
    setSaving(true);
    try {
      const fechaTs = fecha ? Timestamp.fromDate(fecha) : undefined;
      if (editando) {
        await actualizarValorAgregado(clienteId, editando.id!, { ...formData, fechaTs }, archivoFile);
        toast.success("Valor agregado actualizado");
      } else {
        await crearValorAgregado(
          clienteId,
          {
            tipo: formData.tipo as TipoValorAgregado,
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
    } catch (e) {
      console.error(e);
      toast.error("Error guardando el valor agregado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ErrorBoundary>
      <div className="space-y-4 relative">
        {saving && (
          <div className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm grid place-items-center pointer-events-auto">
            <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-lg">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Guardando…</span>
            </div>
          </div>
        )}

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
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t mt-2">
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
                  <div className="pt-6">
                    <Button type="submit" className="w-full" disabled={saving}>
                      {saving ? <span className="inline-flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Guardando…</span> : "Guardar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{formatFechaCO(it.fecha as any) || "—"}</TableCell>
                  <TableCell>{TipoValorAgregadoLabels[it.tipo]}</TableCell>
                  <TableCell>{it.titulo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Paginación */}
        <div className="flex justify-between items-center pt-4">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
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
