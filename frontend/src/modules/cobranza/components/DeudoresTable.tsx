import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Deudor } from "../models/deudores.model";
import {
  calcularDeudaTotal,
  obtenerDeudorPorCliente,
  crearDeudor,
  actualizarDeudor,
  eliminarDeudor,
} from "../services/deudorService";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Button } from "../../../components/ui/button";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";
import { enviarNotificacionCobroMasivo } from "../services/notificacionCobroService";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../../components/ui/dialog";
import { EstadoMensual } from "../models/estadoMensual.model";

// ---- Tipos auxiliares ----
type EstadoForm = Partial<EstadoMensual>;

export default function DeudoresTable() {
  const navigate = useNavigate();
  const { clienteId } = useParams<{ clienteId: string }>();

  // Estado general
  const [deudores, setDeudores] = useState<Deudor[]>([]);
  const [loading, setLoading] = useState(false);

  // Diálogo crear/editar
  const [open, setOpen] = useState(false);
  const [deudorEditando, setDeudorEditando] = useState<Deudor | null>(null);
  const [formData, setFormData] = useState<Partial<Deudor>>({});

  // Eliminar
  const [dialogoEliminar, setDialogoEliminar] = useState(false);
  const [deudorSeleccionado, setDeudorSeleccionado] = useState<Deudor | null>(null);

  // Búsqueda y paginación
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Honorarios
  const [porcentajeHonorarios, setPorcentajeHonorarios] = useState(10);
  const [honorariosCalculados, setHonorariosCalculados] = useState(0);

  // Estado mensual (deuda vive aquí, NO en Deudor)
  const [estadoForm, setEstadoForm] = useState<EstadoForm>({
    mes: new Date().toISOString().slice(0, 7), // YYYY-MM
    tipo: "ordinario",
    deuda: 0,
    honorarios: 0,
    recaudo: 0,
    comprobante: null,
    recibo: null,
    observaciones: null,
  });

  // Cargar deudores
  const fetchDeudores = async () => {
    if (!clienteId) return;
    setLoading(true);
    try {
      const data = await obtenerDeudorPorCliente(clienteId);
      setDeudores(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeudores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  // Calcular honorarios cuando cambie deuda o %
  useEffect(() => {
    const deuda = estadoForm.deuda ?? 0;
    const porcentaje = porcentajeHonorarios ?? 0;
    const honorarios = (deuda * porcentaje) / 100;
    setHonorariosCalculados(isNaN(honorarios) ? 0 : honorarios);
  }, [estadoForm.deuda, porcentajeHonorarios]);

  // Filtrado y paginación
  const filteredDeudores = deudores.filter((d) => (d.ubicacion ?? "").toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filteredDeudores.length / itemsPerPage) || 1;
  const paginatedDeudores = filteredDeudores.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // --- Handlers ---
  const iniciarCrear = () => {
    setDeudorEditando(null);
    setFormData({});
    setPorcentajeHonorarios(10);
    setEstadoForm({
      mes: new Date().toISOString().slice(0, 7),
      tipo: "ordinario",
      deuda: 0,
      honorarios: 0,
      recaudo: 0,
      comprobante: null,
      recibo: null,
      observaciones: null,
    });
    setOpen(true);
  };

  const iniciarEditar = (deudor: Deudor) => {
    setDeudorEditando(deudor);
    setFormData({ ...deudor });
    setPorcentajeHonorarios(deudor.porcentajeHonorarios ?? 10);
    setEstadoForm((prev) => ({
      ...prev,
      mes: new Date().toISOString().slice(0, 7),
      tipo: "ordinario",
      deuda: 0,
      honorarios: 0,
      recaudo: 0,
      comprobante: null,
      recibo: null,
      observaciones: null,
    }));
    setOpen(true);
  };

  const guardarDeudor = async () => {
    if (!clienteId) return;

    if (deudorEditando) {
      const deudorActualizado: Deudor = {
        ...deudorEditando,
        ...formData,
        porcentajeHonorarios: porcentajeHonorarios ?? 0,
        correos: formData.correos ?? [],
        telefonos: formData.telefonos ?? [],
      } as Deudor;
      // Debes construir un EstadoMensual válido aquí, ejemplo:
      const estadoMensualActualizado: EstadoMensual = {
        id: deudorActualizado.id!,
        mes: estadoForm.mes ?? new Date().toISOString().slice(0, 7),
        deuda: estadoForm.deuda ?? 0,
        tipo: estadoForm.tipo ?? "ordinario",
        honorarios: honorariosCalculados,
        recaudo: estadoForm.recaudo ?? 0,
        comprobante: estadoForm.comprobante ?? null,
        recibo: estadoForm.recibo ?? null,
        observaciones: estadoForm.observaciones ?? null,
        // agrega otros campos requeridos por EstadoMensual si es necesario
      };
      await actualizarDeudor(clienteId, estadoMensualActualizado);
    } else {
      const estadoMensualNuevo: EstadoMensual = {
        mes: estadoForm.mes ?? new Date().toISOString().slice(0, 7),
        deuda: estadoForm.deuda ?? 0,
        tipo: estadoForm.tipo ?? "ordinario",
        honorarios: honorariosCalculados,
        recaudo: estadoForm.recaudo ?? 0,
        comprobante: estadoForm.comprobante ?? null,
        recibo: estadoForm.recibo ?? null,
        observaciones: estadoForm.observaciones ?? null,
        // Puedes agregar otros campos requeridos por EstadoMensual aquí si es necesario
        nombre: formData.nombre ?? "",
        cedula: formData.cedula ?? "",
        ubicacion: formData.ubicacion ?? "",
        correos: formData.correos ?? [],
        telefonos: formData.telefonos ?? [],
        porcentajeHonorarios: porcentajeHonorarios ?? 0,
        tipificacion: formData.tipificacion ?? "gestionando",
        estado: formData.estado ?? "prejurídico",
      } as unknown as EstadoMensual;
      await crearDeudor(clienteId, estadoMensualNuevo);
    }

    setOpen(false);
    fetchDeudores();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEnviarNotificaciones = async () => {
    try {
      setLoading(true);
      const resultado = await enviarNotificacionCobroMasivo(filteredDeudores);
      console.log("Resultados:", resultado);
      toast.success("✅ Notificaciones de cobro enviadas correctamente.");
    } catch (err) {
      console.error("Error al enviar notificaciones:", err);
      toast.error("❌ Error al enviar notificaciones.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2">
        <h2 className="text-xl font-semibold">Deudores</h2>
        <Input
          type="text"
          placeholder="Buscar"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className="max-w-md"
        />

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={iniciarCrear}>Crear deudor</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear / Editar deudor</DialogTitle>
            </DialogHeader>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                guardarDeudor();
              }}
            >
              <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-4">
                <div>
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input name="nombre" value={formData.nombre ?? ""} onChange={handleChange} />
                </div>
                <div>
                  <Label htmlFor="cedula">Cédula</Label>
                  <Input name="cedula" value={formData.cedula ?? ""} onChange={handleChange} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ubicacion">Ubicación</Label>
                  <Input name="ubicacion" value={formData.ubicacion ?? ""} onChange={handleChange} />
                </div>
                <div>
                  <Label htmlFor="deuda">Deuda sin honorarios (Estado del mes)</Label>
                  <Input
                    type="number"
                    value={estadoForm.deuda ?? 0}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setEstadoForm((prev) => ({ ...prev, deuda: isNaN(v) ? 0 : v }));
                    }}
                  />
                </div>
                <div>
                  <Label>Tipificación</Label>
                  <Select
                    value={formData.tipificacion ?? "gestionando"}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, tipificacion: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gestionando">Gestionando</SelectItem>
                      <SelectItem value="acuerdo de pago">Acuerdo de Pago</SelectItem>
                      <SelectItem value="acuerdo demanda">Acuerdo + Demanda</SelectItem>
                      <SelectItem value="demandado">Demandado</SelectItem>
                      <SelectItem value="inactivo">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-4 space-y-2">
                <Label>Correos</Label>
                <Input
                  placeholder="correo1@example.com, correo2@example.com"
                  value={formData.correos?.join(", ") ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      correos: e.target.value.split(",").map((c) => c.trim()).filter(Boolean),
                    }))
                  }
                />

                <Label>Teléfonos</Label>
                <Input
                  placeholder="3001234567, 3012345678"
                  value={formData.telefonos?.join(", ") ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      telefonos: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                    }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-4">
                <div>
                  <Label>Porcentaje de honorarios</Label>
                  <Input
                    type="number"
                    name="porcentaje_honorarios"
                    value={porcentajeHonorarios}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setPorcentajeHonorarios(isNaN(v) ? 0 : v);
                    }}
                  />
                </div>
                <div>
                  <Label>Honorarios calculados</Label>
                  <p className="text-green-600 font-bold text-lg">${honorariosCalculados.toLocaleString()}</p>
                </div>
              </div>

              <div className="pt-6">
                <Button type="submit" className="w-full">
                  Guardar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-6">Cargando deudores...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Tipificación</TableHead>
              <TableHead>Deuda Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedDeudores.map((deudor) => (
              <TableRow key={deudor.id}>
                <TableCell>{deudor.nombre}</TableCell>
                <TableCell>{deudor.ubicacion}</TableCell>
                <TableCell>{deudor.tipificacion}</TableCell>
                <TableCell>{deudor.estado}</TableCell>
                <TableCell className="text-center">
                  <TooltipProvider>
                    <div className="flex justify-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => navigate(`/clientes/${clienteId}/deudores/${deudor.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ver deudor</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" onClick={() => iniciarEditar(deudor)}>
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
                              setDeudorSeleccionado(deudor);
                              setDialogoEliminar(true);
                            }}
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

      <Dialog open={dialogoEliminar} onOpenChange={setDialogoEliminar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar deudor?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">¿Estás seguro de que deseas eliminar este deudor? Esta acción no se puede deshacer.</p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogoEliminar(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deudorSeleccionado && clienteId) {
                  await eliminarDeudor(clienteId, deudorSeleccionado.id!);
                  setDialogoEliminar(false);
                  fetchDeudores();
                }
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!loading && filteredDeudores.length > 0 && (
        <div className="pt-4">
          <Button className="bg-primary text-white" onClick={handleEnviarNotificaciones}>
            Enviar notificación de cobro a todos los listados
          </Button>
        </div>
      )}

      <div className="flex justify-between items-center pt-4">
        <p className="text-sm text-muted-foreground">
          Página {currentPage} de {totalPages}
        </p>
        <div className="space-x-2">
          <Button variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
            Anterior
          </Button>
          <Button
            variant="outline"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
