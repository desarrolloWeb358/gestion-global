import React, { useState, useEffect } from "react";
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

// 🔐 ACL
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";

// Sentinela para Select ("Todos")
const ALL = "__ALL__";

export default function DeudoresTable() {
  const navigate = useNavigate();
  const { clienteId } = useParams<{ clienteId: string }>();

  // 🔐 ACL: permisos de la pantalla
  const { can, loading: aclLoading } = useAcl();
  const canView = can(PERMS.Deudores_Read);
  const canEdit = can(PERMS.Deudores_Edit);   // admin/ejecutivo = true; cliente = false
  const readOnly = !canEdit && canView;       // cliente = true

  // Estado general
  const [deudores, setDeudores] = useState<Deudor[]>([]);
  const [loading, setLoading] = useState(false);

  // Diálogo crear/editar
  const [open, setOpen] = useState(false);
  const [deudorEditando, setDeudorEditando] = useState<Deudor | null>(null);
  const [formData, setFormData] = useState<Partial<Deudor> & { porcentajeHonorarios?: number }>({});

  // Eliminar
  const [dialogoEliminar, setDialogoEliminar] = useState(false);
  const [deudorSeleccionado, setDeudorSeleccionado] = useState<Deudor | null>(null);

  const formatCOP = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

  // Filtros y paginación
  const [search, setSearch] = useState("");
  const [tipFilter, setTipFilter] = useState<string>(ALL); // ✅ filtro tipificación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 300;

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
    // 🔐 Bloquear fetch hasta saber permisos y solo si puede ver
    if (aclLoading) return;
    if (!canView) return;
    fetchDeudores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, aclLoading, canView]);

  // Filtrado y paginación
  const normalizedQ = search.trim().toLowerCase();
  const filteredDeudores = deudores.filter((d) => {
    // 🔎 Texto: nombre/cedula/ubicacion
    if (normalizedQ) {
      const hay = `${d.nombre ?? ""} ${d.cedula ?? ""} ${d.ubicacion ?? ""}`.toLowerCase();
      if (!hay.includes(normalizedQ)) return false;
    }
    // 🎯 Tipificación
    if (tipFilter !== ALL) {
      if ((d.tipificacion as string) !== tipFilter) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredDeudores.length / itemsPerPage) || 1;
  const paginatedDeudores = filteredDeudores.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // --- Handlers ---
  const iniciarCrear = () => {
    // 🔐 Bloquear crear si no tiene permiso
    if (!canEdit) return;
    setDeudorEditando(null);
    setFormData({
      tipificacion: TipificacionDeuda.GESTIONANDO,
    });
    setOpen(true);
  };

  const iniciarEditar = (deudor: Deudor) => {
    // 🔐 Bloquear editar si no tiene permiso
    if (!canEdit) return;
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
    // 🔐 Bloquear submit si no tiene permiso
    if (!canEdit) return;

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
      await crearDeudor(clienteId, {
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
      const numericFields = new Set(['porcentajeHonorarios']);
      const parsedValue =
        numericFields.has(name)
          ? (value === '' ? undefined : Number(value))
          : value;

      return { ...prev, [name]: parsedValue as any };
    });
  };

  const handleEnviarNotificaciones = async () => {
    // 🔐 Opcional: solo RW puede enviar masivo
    if (!canEdit) return;
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

  // 🔐 1) Bloquear mientras se cargan los permisos
  if (aclLoading) {
    return <p className="text-muted-foreground text-center py-6">Cargando permisos…</p>;
  }

  // 🔐 2) Sin permiso de lectura → no renderizar contenido
  if (!canView) {
    return <p className="text-center py-6">No tienes acceso a Deudores.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Encabezado + Filtros */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center gap-2">
          <h2 className="text-xl font-semibold">Deudores</h2>

          <Dialog open={open} onOpenChange={setOpen}>
            {/* 🔐 3) Botón “Crear deudor” solo si puede editar */}
            {canEdit && (
              <DialogTrigger asChild>
                <Button onClick={iniciarCrear}>Crear deudor</Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                {/* 🔐 Título opcional dinámico según modo */}
                <DialogTitle>{deudorEditando ? (readOnly ? "Ver deudor" : "Editar deudor") : (readOnly ? "Ver deudor" : "Crear deudor")}</DialogTitle>
              </DialogHeader>

              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  // 🔐 4) En RO no se envía
                  if (!readOnly) guardarDeudor();
                }}
              >
                <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-4">
                  <div>
                    <Label htmlFor="nombre">Nombre</Label>
                    <Input name="nombre" value={formData.nombre ?? ""} onChange={handleChange} readOnly={readOnly} />
                  </div>
                  <div>
                    <Label htmlFor="cedula">Cédula</Label>
                    <Input name="cedula" value={formData.cedula ?? ""} onChange={handleChange} readOnly={readOnly} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ubicacion">Ubicación</Label>
                    <Input name="ubicacion" value={formData.ubicacion ?? ""} onChange={handleChange} readOnly={readOnly} />
                  </div>
                  <div>
                    <Label>Tipificación</Label>
                    <Select
                      // 🔐 Select deshabilitado en RO
                      disabled={readOnly}
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
                    readOnly={readOnly}
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
                    readOnly={readOnly}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-4">
                  <div>
                    <Label htmlFor="porcentajeHonorarios">Porcentaje de honorarios</Label>
                    <Input
                      type="number"
                      name="porcentajeHonorarios"
                      value={formData.porcentajeHonorarios ?? 15}
                      onChange={handleChange}
                      readOnly={readOnly}
                    />
                  </div>
                </div>

                {/* 🔐 5) Ocultar botón Guardar en RO */}
                {!readOnly && (
                  <div className="pt-6">
                    <Button type="submit" className="w-full">
                      Guardar
                    </Button>
                  </div>
                )}
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* 🔎 Filtros de tabla */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label>Búsqueda</Label>
            <Input
              type="text"
              placeholder="Buscar por nombre, cédula o ubicación…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div>
            <Label>Tipificación</Label>
            <Select value={tipFilter} onValueChange={(v) => { setTipFilter(v); setCurrentPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                {/* ✅ NO usar value="" */}
                <SelectItem value={ALL}>Todos</SelectItem>
                {Object.values(TipificacionDeuda).map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSearch("");
                setTipFilter(ALL);
                setCurrentPage(1);
              }}
            >
              Limpiar filtros
            </Button>
          </div>
        </div>
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
                        {/* Ver: siempre visible porque ya pasó canView */}
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

                        {/* 🔐 Editar: solo si canEdit */}
                        {canEdit && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="icon" onClick={() => iniciarEditar(deudor)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar</TooltipContent>
                          </Tooltip>
                        )}

                        {/* 🔐 Eliminar: solo si canEdit */}
                        {canEdit && (
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
                        )}
                      </div>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
