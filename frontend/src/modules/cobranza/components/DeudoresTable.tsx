import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Deudor } from "../models/deudores.model";

import {
  obtenerDeudorPorCliente,
  crearDeudor,
  eliminarDeudor,
  actualizarDeudorDatos
} from "../services/deudorService";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { enviarNotificacionCobroMasivo } from "../services/notificacionCobroService";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";

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

  const formatCOP = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

  // Búsqueda y paginación
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  
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

  // Filtrado y paginación
  const filteredDeudores = deudores.filter((d) => (d.ubicacion ?? "").toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filteredDeudores.length / itemsPerPage) || 1;
  const paginatedDeudores = filteredDeudores.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // --- Handlers ---
  const iniciarCrear = () => {
    setDeudorEditando(null);
    setFormData({
      tipificacion: TipificacionDeuda.GESTIONANDO,
    });
    setOpen(true);
  };

  const iniciarEditar = (deudor: Deudor) => {
    setDeudorEditando(deudor);
    setFormData({ ...deudor });
    setOpen(true);
  };

  // Cambiar tipificación en diálogo (estado local)
  const onChangeTipificacion = (val: string) => {
    const t = val as TipificacionDeuda;
    setFormData((prev) => ({ ...prev, tipificacion: t }));
  };

  // Guardar (crear o actualizar)
  const guardarDeudor = async () => {
    if (!clienteId) return;

    if (deudorEditando) {
      // 1) Actualiza datos del DEUDOR (sin estados mensuales)
      await actualizarDeudorDatos(clienteId, deudorEditando.id!, {
        nombre: formData.nombre,
        cedula: formData.cedula,
        ubicacion: formData.ubicacion,
        correos: formData.correos ?? [],
        telefonos: formData.telefonos ?? [],
        tipificacion: formData.tipificacion as TipificacionDeuda,    
        porcentajeHonorarios: Number(formData.porcentajeHonorarios ?? 15),
      });

    } else {
      // 1) Crea el DEUDOR
      const newDeudorId = await crearDeudor(clienteId, {
        nombre: formData.nombre ?? "",
        cedula: formData.cedula,
        ubicacion: formData.ubicacion,
        porcentajeHonorarios: Number(formData.porcentajeHonorarios ?? 15),
        correos: formData.correos ?? [],
        telefonos: formData.telefonos ?? [],
        tipificacion: (formData.tipificacion as TipificacionDeuda) ?? TipificacionDeuda.GESTIONANDO,
      });

    }

    setOpen(false);
    fetchDeudores();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value } = e.target;

  setFormData((prev) => {
    // Campos numéricos que quieres forzar a number:
    const numericFields = new Set(['porcentajeHonorarios']);
    const parsedValue =
      numericFields.has(name)
        ? (value === '' ? undefined : Number(value)) // permite limpiar y reescribir
        : value;

    return { ...prev, [name]: parsedValue as any };
  });
};
  
  const handleEnviarNotificaciones = async () => {
    try {
      setLoading(true);
      const resultado = await enviarNotificacionCobroMasivo(filteredDeudores);
      console.log("Resultados:", resultado);
      toast.success("Notificaciones de cobro enviadas correctamente.");
    } catch (err) {
      console.error("Error al enviar notificaciones:", err);
      toast.error("Error al enviar notificaciones.");
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
                  <Label>Tipificación</Label>
                  <Select
                    value={(formData.tipificacion as TipificacionDeuda) ?? TipificacionDeuda.GESTIONANDO}
                    onValueChange={onChangeTipificacion}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(TipificacionDeuda).map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
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
                  <Label htmlFor="porcentajeHonorarios">Porcentaje de honorarios</Label>
                  <Input type="number" name="porcentajeHonorarios" value={formData.porcentajeHonorarios ?? 15} onChange={handleChange} />
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
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedDeudores.map((deudor) => {              
              return (
                <TableRow key={deudor.id}>
                  <TableCell>{deudor.nombre}</TableCell>
                  <TableCell>{deudor.ubicacion}</TableCell>
                  <TableCell>{deudor.tipificacion}</TableCell>
                 
                  {/* Columna Acciones */}
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
              );
            })}
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
