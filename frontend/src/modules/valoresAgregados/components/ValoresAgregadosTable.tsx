// src/modules/cobranza/components/ValoresAgregadosTable.tsx
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";

import { ValorAgregado } from "../models/valorAgregado.model";
import {
  listarValoresAgregados,
  crearValorAgregado,
  actualizarValorAgregado,
  formatFechaCO,
  listarObservacionesCliente,
  crearObservacionCliente,
} from "../services/valorAgregadoService";
import { TipoValorAgregado, TipoValorAgregadoLabels } from "../../../shared/constants/tipoValorAgregado";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/ui/select";
import { Label } from "@/shared/ui/label"; // ✅ corregido
import { ObservacionCliente } from "@/modules/cobranza/models/observacionCliente.model";
import { getAuth } from "firebase/auth";

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

  const canView = can(PERMS.Valores_Read);
  const canEdit = canView && !roles.includes("cliente"); // cliente solo lectura

  // Permisos para Observaciones del cliente (Valores Agregados)
  const puedeVerObsCliente = can(PERMS.Valores_Read);
  const puedeCrearObsCliente = can(PERMS.Valores_Obs_Create);

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

  // === Observaciones del cliente ===
  const [openObs, setOpenObs] = useState(false);
  const [valorObsActual, setValorObsActual] = useState<ValorAgregado | null>(null);
  const [obsLoading, setObsLoading] = useState(false);
  const [obsSaving, setObsSaving] = useState(false);
  const [obsTexto, setObsTexto] = useState("");
  const [obsItems, setObsItems] = useState<ObservacionCliente[]>([]);


  async function onSaveObs() {
    if (!clienteId || !valorObsActual || !obsTexto.trim() || obsSaving) return;
    if (!puedeCrearObsCliente) return; // 🔒 defensa extra
    setObsSaving(true);
    try {
      // ✅ service con scope + parentId
      await crearObservacionCliente(clienteId, valorObsActual.id!, {
        texto: obsTexto,
        creadoPorUid: getAuth().currentUser?.uid,
        creadoPorNombre:
          getAuth().currentUser?.displayName || getAuth().currentUser?.email || roles[0] || "Usuario",
      });

      toast.success("Observación guardada y notificada");
      setObsTexto("");

      // Refrescar listado local
      const data = await listarObservacionesCliente(clienteId, valorObsActual.id!);
      setObsItems(data);
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar o notificar la observación");
    } finally {
      setObsSaving(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    fetchData();
  }, [clienteId, canView]);

  const MAX_FILE_MB = 15;
  function formatBytes(bytes: number) {
    if (!bytes && bytes !== 0) return "";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const val = bytes / Math.pow(1024, i);
    return `${val.toFixed(val > 10 ? 0 : 1)} ${sizes[i]}`;
  }
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
  const goDetalle = (it: ValorAgregado) => {
    if (!clienteId || !it.id) return;
    navigate(`/clientes/${clienteId}/valores-agregados/${it.id}`);
  };
  const onSubmit = async () => {
    if (!clienteId || saving || !canEdit) return;
    setSaving(true);
    try {
      const fechaTs = fecha ? Timestamp.fromDate(fecha) : undefined;
      // en onSubmit:
      if (editando) {
        await actualizarValorAgregado(
          clienteId,
          editando.id!,
          { ...formData, fechaTs },
          archivoFile // <-- importante
        );
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
          archivoFile // <-- importante
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
                      placeholder="Anota
                       contexto, acuerdos, radicados, notas internas…"
                      className="min-h-40 max-h-80 overflow-y-auto resize-y"
                      maxLength={1000}
                    />
                  </div>
                  {/* Archivo adjunto */}
                  <div className="space-y-2">
                    <Label>Archivo adjunto</Label>

                    {/* Info de archivo actual (cuando editas y hay uno existente) */}
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
                      <input
                        id="archivo-valor-agregado"
                        type="file"
                        className="hidden"
                        // Ajusta tipos aceptados si quieres más/menos
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

        {loading ? (
          <p className="text-muted-foreground text-center py-6">Cargando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="w-[140px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {paginated.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{formatFechaCO(it.fecha as any) || "—"}</TableCell>
                  <TableCell>{TipoValorAgregadoLabels[it.tipo]}</TableCell>
                  <TableCell>{it.titulo}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => goDetalle(it)}>
                      Ver
                    </Button>
                  </TableCell>
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

        {/* Dialogo Observaciones del cliente */}
        <Dialog open={openObs} onOpenChange={setOpenObs}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Observaciones del cliente {valorObsActual ? `— ${valorObsActual.titulo}` : ""}
              </DialogTitle>
            </DialogHeader>

            {/* Historial */}
            {obsLoading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : obsItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin observaciones aún.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto border rounded">
                <ul className="divide-y">
                  {obsItems.map((o) => (
                    <li key={o.id} className="p-3">
                      <p className="text-sm whitespace-pre-wrap">{o.texto}</p>
                      <div className="mt-1 text-xs text-muted-foreground">
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Form para crear (solo si tiene permiso) */}
            {puedeCrearObsCliente && (
              <div className="space-y-2 mt-4">
                <Label>Escribir observación</Label>
                <Textarea
                  value={obsTexto}
                  onChange={(e) => setObsTexto(e.target.value)}
                  placeholder="Redacta tu observación…"
                  className="min-h-32"
                  maxLength={1000}
                  disabled={obsSaving}
                />
                <div className="flex justify-end">
                  <Button onClick={onSaveObs} disabled={obsSaving || !obsTexto.trim()}>
                    {obsSaving ? "Guardando…" : "Guardar y notificar"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
