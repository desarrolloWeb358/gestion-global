import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { deudor } from "../models/deudores.model";
import { obtenerDeudorPorCliente, crearDeudor, actualizarDeudor, eliminarDeudor } from "../services/deudorService";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Button } from "../../../components/ui/button";
import { Eye, History, Pencil, Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../components/ui/tooltip";

import { enviarNotificacionCobroMasivo } from "../services/notificacionCobroService";
import { toast } from "sonner";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog";


export default function DeudoresTable() {
  const navigate = useNavigate();
  const { clienteId } = useParams<{ clienteId: string }>();
  const [deudores, setDeudores] = useState<deudor[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [deudorEditando, setDeudorEditando] = useState<deudor | null>(null);
  const [formData, setFormData] = useState<Partial<deudor>>({});
  const [dialogoEliminar, setDialogoEliminar] = useState(false);
  const [deudorSeleccionado, setDeudorSeleccionado] = useState<deudor | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const fetchDeudores = async () => {
    if (!clienteId) return;
    setLoading(true);
    const data = await obtenerDeudorPorCliente(clienteId);
    setDeudores(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchDeudores();
  }, [clienteId]);

  const filteredDeudores = deudores.filter((deudor) =>
    `${deudor.ubicacion ?? ""}}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredDeudores.length / itemsPerPage);
  const paginatedDeudores = filteredDeudores.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const iniciarCrear = () => {
    setDeudorEditando(null);
    setFormData({});
    setOpen(true);
  };

  const iniciarEditar = (deudor: deudor) => {
    setDeudorEditando(deudor);
    setFormData({ ...deudor });
    setOpen(true);
  };

  const guardarDeudor = async () => {
    if (!clienteId) return;

    if (deudorEditando) {
      await actualizarDeudor(clienteId, {
        ...deudorEditando,
        ...formData,
      } as deudor);
    } else {
      await crearDeudor(clienteId, {
        ...formData,
        nombre: formData.nombre ?? "",
        correos: formData.correos ?? [],
        telefonos: formData.telefonos ?? [],
        deuda_total: formData.deuda_total ?? 0,
        tipificacion: formData.tipificacion ?? "gestionando",
      } as deudor);
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
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Deudores</h2>
        <Input
          type="text"
          placeholder="Buscar"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1); // Reiniciar a página 1 cuando se busca
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ubicacion">Ubicación</Label>
                  <Input name="ubicacion" value={formData.ubicacion ?? ""} onChange={handleChange} />
                </div>
                <div>
                  <Label htmlFor="deuda_total">Deuda Total</Label>
                  <Input
                    name="deuda_total"
                    type="number"
                    value={formData.deuda_total !== undefined ? formData.deuda_total : ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        deuda_total: Number(e.target.value),
                      }))
                    }
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
                      correos: e.target.value.split(",").map((c) => c.trim()),
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
                      telefonos: e.target.value.split(",").map((t) => t.trim()),
                    }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-4">
                <div>
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    name="nombre"
                    value={formData.nombre ?? ""}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <Label htmlFor="cedula">Cédula</Label>
                  <Input
                    name="cedula"
                    value={formData.cedula ?? ""}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-4">
                <div>
                  <Label htmlFor="porcentaje_honorarios">% Honorarios</Label>
                  <Input
                    name="porcentaje_honorarios"
                    type="number"
                    value={formData.porcentaje_honorarios ?? ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        porcentaje_honorarios: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              <div className="pt-6">
                <Button type="submit" className="w-full">
                  Guardar
                </Button>
              </div>
            </form>
            {/* Aquí irá el formulario luego */}
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-6">Cargando deudores...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
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
                <TableCell>{deudor.ubicacion}</TableCell>
                <TableCell>{deudor.tipificacion}</TableCell>
                <TableCell>${deudor.deuda_total.toLocaleString()}</TableCell>
                <TableCell>{deudor.estado}</TableCell> {/* Aquí va el estado real */}
                <TableCell className="text-center">
                  <TooltipProvider>
                    <div className="flex justify-center gap-2">
                      {/* Ver Acuerdo */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => navigate(`/deudores/${clienteId}/${deudor.id}/acuerdo`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ver Acuerdo</TooltipContent>
                      </Tooltip>

                      {/* Historial */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => navigate(`/deudores/${clienteId}/${deudor.id}/seguimiento`)}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Historial</TooltipContent>
                      </Tooltip>

                      {/* Editar */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" onClick={() => iniciarEditar(deudor)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar</TooltipContent>
                      </Tooltip>

                      {/* Eliminar */}
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
      )
      }
      <Dialog open={dialogoEliminar} onOpenChange={setDialogoEliminar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar deudor?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de que deseas eliminar este deudor? Esta acción no se puede deshacer.
          </p>
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
          <Button variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
            Siguiente
          </Button>
        </div>
      </div>
    </div >

  );

}
