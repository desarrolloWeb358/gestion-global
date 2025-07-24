import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Inmueble } from "../models/inmueble.model";
import { obtenerInmueblesPorCliente, crearInmueble, actualizarInmueble, eliminarInmueble } from "../services/inmuebleService";
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


export default function InmueblesTable() {
  const navigate = useNavigate();
  const { clienteId } = useParams<{ clienteId: string }>();
  const [inmuebles, setInmuebles] = useState<Inmueble[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [inmuebleEditando, setInmuebleEditando] = useState<Inmueble | null>(null);
  const [formData, setFormData] = useState<Partial<Inmueble>>({});
  const [dialogoEliminar, setDialogoEliminar] = useState(false);
  const [inmuebleSeleccionado, setInmuebleSeleccionado] = useState<Inmueble | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const fetchInmuebles = async () => {
    if (!clienteId) return;
    setLoading(true);
    const data = await obtenerInmueblesPorCliente(clienteId);
    setInmuebles(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchInmuebles();
  }, [clienteId]);

  const filteredInmuebles = inmuebles.filter((inmueble) =>
    `${inmueble.torre ?? ""} ${inmueble.apartamento ?? ""} ${inmueble.casa ?? ""} ${inmueble.nombreResponsable ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredInmuebles.length / itemsPerPage);
  const paginatedInmuebles = filteredInmuebles.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const iniciarCrear = () => {
    setInmuebleEditando(null);
    setFormData({});
    setOpen(true);
  };

  const iniciarEditar = (inmueble: Inmueble) => {
    setInmuebleEditando(inmueble);
    setFormData({ ...inmueble });
    setOpen(true);
  };

  const guardarInmueble = async () => {
    if (!clienteId) return;

    if (inmuebleEditando) {
      await actualizarInmueble(clienteId, {
        ...inmuebleEditando,
        ...formData,
      } as Inmueble);
    } else {
      await crearInmueble(clienteId, {
        ...formData,
        nombreResponsable: formData.nombreResponsable ?? "",
        correos: formData.correos ?? [],
        telefonos: formData.telefonos ?? [],
        deuda_total: formData.deuda_total ?? 0,
        tipificacion: formData.tipificacion ?? "gestionando",
      } as Inmueble);
    }

    setOpen(false);
    fetchInmuebles();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEnviarNotificaciones = async () => {
    try {
      setLoading(true);
      const resultado = await enviarNotificacionCobroMasivo(filteredInmuebles);
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
        <h2 className="text-xl font-semibold">Inmuebles</h2>
        <Input
          type="text"
          placeholder="Buscar por torre, apartamento, casa o responsable..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1); // Reiniciar a página 1 cuando se busca
          }}
          className="max-w-md"
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={iniciarCrear}>Crear Inmueble</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear / Editar Inmueble</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                guardarInmueble();
              }}
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="torre">Torre</Label>
                  <Input name="torre" value={formData.torre ?? ""} onChange={handleChange} />
                </div>
                <div>
                  <Label htmlFor="apartamento">Apartamento</Label>
                  <Input name="apartamento" value={formData.apartamento ?? ""} onChange={handleChange} />
                </div>
                <div>
                  <Label htmlFor="casa">Casa</Label>
                  <Input name="casa" value={formData.casa ?? ""} onChange={handleChange} />
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
                  <Label htmlFor="nombreResponsable">Nombre del Responsable</Label>
                  <Input
                    name="nombreResponsable"
                    value={formData.nombreResponsable ?? ""}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <Label htmlFor="cedulaResponsable">Cédula del Responsable</Label>
                  <Input
                    name="cedulaResponsable"
                    value={formData.cedulaResponsable ?? ""}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <Label htmlFor="correoResponsable">Correo del Responsable</Label>
                  <Input
                    name="correoResponsable"
                    value={formData.correoResponsable ?? ""}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <Label htmlFor="telefonoResponsable">Teléfono del Responsable</Label>
                  <Input
                    name="telefonoResponsable"
                    value={formData.telefonoResponsable ?? ""}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-4">
                <div>
                  <Label htmlFor="estado">Estado</Label>
                  <Select
                    value={formData.estado ?? "gestionando"}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, estado: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un estado" />
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
        <p className="text-muted-foreground text-center py-6">Cargando inmuebles...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>

              <TableHead>Torre</TableHead>
              <TableHead>Apartamento</TableHead>
              <TableHead>Casa</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Deuda</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedInmuebles.map((inmueble) => (
              <TableRow key={inmueble.id}>
                <TableCell>{inmueble.torre}</TableCell>
                <TableCell>{inmueble.apartamento}</TableCell>
                <TableCell>{inmueble.casa}</TableCell>
                <TableCell>{inmueble.tipificacion}</TableCell>
                <TableCell>${inmueble.deuda_total.toLocaleString()}</TableCell>
                <TableCell className="text-center">
                  <TooltipProvider>
                    <div className="flex justify-center gap-2">
                      {/* Ver Acuerdo */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => navigate(`/inmuebles/${clienteId}/${inmueble.id}/acuerdo`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ver Acuerdo</TooltipContent>
                      </Tooltip>

                      {/* Ver Historial */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => navigate(`/inmuebles/${clienteId}/${inmueble.id}/seguimiento`)}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Historial</TooltipContent>
                      </Tooltip>

                      {/* Editar */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" onClick={() => iniciarEditar(inmueble)}>
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
                              setInmuebleSeleccionado(inmueble);
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
            <DialogTitle>¿Eliminar inmueble?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Estás seguro de que deseas eliminar este inmueble? Esta acción no se puede deshacer.
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogoEliminar(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (inmuebleSeleccionado && clienteId) {
                  await eliminarInmueble(clienteId, inmuebleSeleccionado.id!);
                  setDialogoEliminar(false);
                  fetchInmuebles();
                }
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!loading && filteredInmuebles.length > 0 && (
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
    </div>

  );

}
