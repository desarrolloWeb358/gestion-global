import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Eye, Pencil, Search, X, Users, UserPlus, Filter, FileText } from "lucide-react";
import { createPortal } from "react-dom";

import { Deudor } from "../models/deudores.model";
import {
  obtenerDeudorPorCliente,
  crearDeudor,
  actualizarDeudorDatos
} from "../services/deudorService";

import { Cliente } from "@/modules/clientes/models/cliente.model";
import { getClienteById } from "@/modules/clientes/services/clienteService";
import { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { obtenerUsuarios } from "@/modules/usuarios/services/usuarioService";
import { BadgeTipificacion } from "@/shared/components/BadgeTipificacion";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";
import { Typography } from "@/shared/design-system/components/Typography";
import { BackButton } from "@/shared/design-system/components/BackButton";
import { cn } from "@/shared/lib/cn";

// 🔐 ACL
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";

const ALL = "__ALL__";



export default function DeudoresTable() {
  const navigate = useNavigate();
  const { clienteId } = useParams<{ clienteId: string }>();

  const { can, loading: aclLoading } = useAcl();
  const canView = can(PERMS.Deudores_Read);
  const canEdit = can(PERMS.Deudores_Edit);
  const readOnly = !canEdit && canView;

  const [deudores, setDeudores] = useState<Deudor[]>([]);
  const [loading, setLoading] = useState(false);
  const [prevPorcentaje, setPrevPorcentaje] = useState<number | null>(null);

  const [open, setOpen] = useState(false);
  const [deudorEditando, setDeudorEditando] = useState<Deudor | null>(null);
  const [formData, setFormData] = useState<Partial<Deudor> & { porcentajeHonorarios?: number | string }>({});

  // ✅ BLOQUEO GLOBAL
  const [saving, setSaving] = useState(false);

  // Estado para cliente y usuarios
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [nombreCliente, setNombreCliente] = useState<string>("Cargando...");

  const [search, setSearch] = useState("");
  const [tipFilter, setTipFilter] = useState<string>(ALL);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 300;

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

  const fetchCliente = async () => {
    if (!clienteId) return;
    try {
      const clienteData = await getClienteById(clienteId);
      setCliente(clienteData);

      if (clienteData) {
        if ((clienteData as any).nombre) {
          setNombreCliente((clienteData as any).nombre);
        } else {
          const todosUsuarios = await obtenerUsuarios();
          setUsuarios(todosUsuarios);

          const usuarioEncontrado = todosUsuarios.find(u => u.uid === clienteId);

          if (usuarioEncontrado) {
            setNombreCliente(
              usuarioEncontrado.nombre ??
              (usuarioEncontrado as any).displayName ??
              usuarioEncontrado.email ??
              "Cliente"
            );
          } else {
            setNombreCliente("Cliente");
          }
        }
      } else {
        setNombreCliente("Cliente");
      }
    } catch (error) {
      console.error("Error al cargar cliente:", error);
      setNombreCliente("Cliente");
    }
  };

  useEffect(() => {
    if (aclLoading) return;
    if (!canView) return;
    fetchDeudores();
    fetchCliente();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, aclLoading, canView]);

  const normalizedQ = search.trim().toLowerCase();

  const isInactivo = (t?: string) =>
    t === (TipificacionDeuda as any).INACTIVO || t === "INACTIVO";

  const filteredDeudores = deudores.filter((d) => {
    if (normalizedQ) {
      const hay = `${d.nombre ?? ""} ${d.cedula ?? ""} ${d.ubicacion ?? ""}`.toLowerCase();
      if (!hay.includes(normalizedQ)) return false;
    }
    if (tipFilter === ALL) {
      if (isInactivo(d.tipificacion as string)) return false;
    } else {
      if ((d.tipificacion as string) !== tipFilter) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredDeudores.length / itemsPerPage) || 1;
  const paginatedDeudores = filteredDeudores.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const iniciarCrear = () => {
    if (!canEdit) return;
    setDeudorEditando(null);
    setFormData({
      tipificacion: TipificacionDeuda.GESTIONANDO,
      porcentajeHonorarios: 15,
    });
    setOpen(true);
  };

  const iniciarEditar = (deudor: Deudor) => {
    if (!canEdit) return;
    setDeudorEditando(deudor);

    const porcentaje =
      deudor.porcentajeHonorarios !== undefined && deudor.porcentajeHonorarios !== null
        ? Number(deudor.porcentajeHonorarios)
        : 15;

    setFormData({
      ...deudor,
      porcentajeHonorarios: porcentaje,
    });

    setOpen(true);
  };

  const onChangeTipificacion = (val: string) => {
  const t = val as TipificacionDeuda;

  setFormData((prev) => {
    const esDemanda =
      t === TipificacionDeuda.DEMANDA ||
      t === TipificacionDeuda.DEMANDA_ACUERDO ||
      t === TipificacionDeuda.DEMANDA_TERMINADO ||
      t === TipificacionDeuda.DEMANDA_INSOLVENCIA;

    return {
      ...prev,
      tipificacion: t,
      porcentajeHonorarios: esDemanda ? 20 : (prev.porcentajeHonorarios ?? 15),
    };
  });
};




  // ✅ IMPORTANTE: SIEMPRE try/finally para que no se quede pegado
  const guardarDeudor = async () => {
    if (!clienteId) return;
    if (!canEdit) return;

    const valorActual = formData.porcentajeHonorarios as number | string | undefined;
    const porcentajeFinal =
      valorActual === undefined || valorActual === null || valorActual === ""
        ? 15
        : Number(valorActual);

    setSaving(true);
    try {
      if (deudorEditando) {
        await actualizarDeudorDatos(clienteId, deudorEditando.id!, {
          nombre: formData.nombre,
          cedula: formData.cedula,
          ubicacion: formData.ubicacion,
          correos: formData.correos ?? [],
          telefonos: formData.telefonos ?? [],
          tipificacion: formData.tipificacion as TipificacionDeuda,
          porcentajeHonorarios: porcentajeFinal,
        });
        toast.success("✓ Deudor actualizado correctamente");
      } else {
        await crearDeudor(clienteId, {
          nombre: formData.nombre ?? "",
          cedula: formData.cedula,
          ubicacion: formData.ubicacion,
          porcentajeHonorarios: porcentajeFinal,
          correos: formData.correos ?? [],
          telefonos: formData.telefonos ?? [],
          tipificacion:
            (formData.tipificacion as TipificacionDeuda) ?? TipificacionDeuda.GESTIONANDO,
        });
        toast.success("✓ Deudor creado correctamente");
      }

      setOpen(false);
      await fetchDeudores();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message ?? "Error al guardar el deudor");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "porcentajeHonorarios") {
      setFormData((prev) => ({
        ...prev,
        porcentajeHonorarios: value === "" ? undefined : Number(value),
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };


  // ✅ Overlay global (portal) - bloquea toda la pantalla
  const GlobalBlockingOverlay = saving
    ? createPortal(
      <div className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-sm flex items-center justify-center">
        <div className="rounded-xl bg-white shadow-xl px-6 py-5 flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
          <Typography variant="body" className="font-medium">
            {deudorEditando ? "Guardando cambios..." : "Creando deudor..."}
          </Typography>
        </div>
      </div>,
      document.body
    )
    : null;

  if (aclLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-4" />
          <Typography variant="body">Cargando permisos...</Typography>
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <Typography variant="h2" className="text-brand-secondary mb-2">
            Acceso denegado
          </Typography>
          <Typography variant="body">No tienes permisos para ver esta sección.</Typography>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      {GlobalBlockingOverlay}

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">

        {/* HEADER */}
        <header className="space-y-4">
          <div className="flex items-center gap-2">
            <BackButton
              variant="ghost"
              size="sm"
              to={`/clientes/${clienteId}`}
              className="text-brand-secondary hover:text-brand-primary hover:bg-brand-primary/5 transition-all"
            />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand-primary/10">
                  <Users className="h-6 w-6 text-brand-primary" />
                </div>
                <div>
                  <Typography variant="h2" className="!text-brand-primary font-bold">
                    Deudores de {nombreCliente}
                  </Typography>
                  <Typography variant="small" className="mt-0.5">
                    {filteredDeudores.length}{" "}
                    {filteredDeudores.length === 1 ? "deudor encontrado" : "deudores encontrados"}
                  </Typography>
                </div>
              </div>
            </div>

            {canEdit && (
              <Dialog open={open} onOpenChange={(v) => !saving && setOpen(v)}>
                <DialogTrigger asChild>
                  <Button
                    variant="brand"
                    onClick={iniciarCrear}
                    className="gap-2 shadow-md hover:shadow-lg transition-all"
                    disabled={saving}
                  >
                    <UserPlus className="h-4 w-4" />
                    Crear Deudor
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-brand-primary text-xl font-bold flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      {deudorEditando ? (readOnly ? "Ver deudor" : "Editar deudor") : "Crear nuevo deudor"}
                    </DialogTitle>
                  </DialogHeader>

                  <form
                    className="space-y-6 py-4"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!readOnly) await guardarDeudor();
                    }}
                  >
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-brand-secondary font-medium">Nombre completo</Label>
                          <Input
                            name="nombre"
                            value={formData.nombre ?? ""}
                            onChange={handleChange}
                            readOnly={readOnly || saving}
                            className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                            placeholder="Ej: Juan Pérez"
                          />
                        </div>
                        <div>
                          <Label className="text-brand-secondary font-medium">Cédula</Label>
                          <Input
                            name="cedula"
                            value={formData.cedula ?? ""}
                            onChange={handleChange}
                            readOnly={readOnly || saving}
                            className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                            placeholder="1234567890"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-brand-secondary font-medium">Ubicación</Label>
                          <Input
                            name="ubicacion"
                            value={formData.ubicacion ?? ""}
                            onChange={handleChange}
                            readOnly={readOnly || saving}
                            className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                            placeholder="Ciudad, Departamento"
                          />
                        </div>
                        <div>
                          <Label className="text-brand-secondary font-medium">Tipificación</Label>
                          <Select
                            disabled={readOnly || saving}
                            value={(formData.tipificacion as TipificacionDeuda) ?? TipificacionDeuda.GESTIONANDO}
                            onValueChange={onChangeTipificacion}
                          >
                            <SelectTrigger className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20">
                              <SelectValue placeholder="Selecciona una tipificación" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.values(TipificacionDeuda).map((t) => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label className="text-brand-secondary font-medium">Porcentaje de honorarios (%)</Label>
                        <Input
                          type="number"
                          name="porcentajeHonorarios"
                          value={formData.porcentajeHonorarios ?? ""}
                          readOnly={readOnly || saving}
                          onChange={handleChange}
                        />
                      </div>

                      <div className="space-y-3 pt-4 border-t border-brand-secondary/10">
                        <div>
                          <Label className="text-brand-secondary font-medium">Correos electrónicos</Label>
                          <Input
                            placeholder="correo1@example.com, correo2@example.com"
                            value={formData.correos?.join(", ") ?? ""}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                correos: e.target.value.split(",").map((c) => c.trim()).filter(Boolean),
                              }))
                            }
                            readOnly={readOnly || saving}
                            className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                          />
                          <p className="text-xs mt-1">Separa múltiples correos con comas</p>
                        </div>

                        <div>
                          <Label className="text-brand-secondary font-medium">Teléfonos</Label>
                          <Input
                            placeholder="3001234567, 3012345678"
                            value={formData.telefonos?.join(", ") ?? ""}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                telefonos: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                              }))
                            }
                            readOnly={readOnly || saving}
                            className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                          />
                          <p className="text-xs mt-1">Separa múltiples teléfonos con comas</p>
                        </div>
                      </div>
                    </div>

                    <DialogFooter className="gap-2">
                      {!readOnly && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => !saving && setOpen(false)}
                            className="border-brand-secondary/30"
                            disabled={saving}
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="submit"
                            variant="brand"
                            disabled={saving}
                          >
                            {deudorEditando ? "Guardar cambios" : "Crear deudor"}
                          </Button>
                        </>
                      )}
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </header>

        {/* FILTROS */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-brand-primary/10">
                <Filter className="h-4 w-4 text-brand-primary" />
              </div>
              <Typography variant="h3" className="!text-brand-secondary font-semibold">
                Filtros de búsqueda
              </Typography>
            </div>
          </div>

          <div className="p-4 md:p-5">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-2">
                <Label className="mb-2 block text-brand-secondary font-medium">Búsqueda</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-secondary/60" />
                  <Input
                    type="text"
                    placeholder="Buscar por nombre, cédula o ubicación..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 border-brand-secondary/30 bg-white focus:border-brand-primary focus:ring-brand-primary/20"
                  />
                  {search && (
                    <Button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-gray-100 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <Label className="mb-2 block text-brand-secondary font-medium">Tipificación</Label>
                <Select
                  value={tipFilter}
                  onValueChange={(v) => {
                    setTipFilter(v);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="border-brand-secondary/30 bg-white focus:border-brand-primary focus:ring-brand-primary/20">
                    <SelectValue placeholder="Todas las tipificaciones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos (sin inactivos)</SelectItem>
                    {Object.values(TipificacionDeuda).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  className={cn(
                    "w-full border-brand-secondary/30 text-brand-secondary hover:bg-brand-primary/5",
                    (!search && tipFilter === ALL) && "opacity-50 pointer-events-none"
                  )}
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
        </section>

        {/* TABLA */}
        {loading ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
              <Typography variant="body">Cargando deudores...</Typography>
            </div>
          </div>
        ) : filteredDeudores.length === 0 ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-brand-primary/10">
                <Users className="h-8 w-8 text-brand-primary/60" />
              </div>
              <Typography variant="h3" className="text-brand-secondary">
                No hay resultados
              </Typography>
              <Typography variant="small" className="max-w-md">
                {search || tipFilter !== ALL
                  ? "No se encontraron deudores que coincidan con los filtros aplicados."
                  : "Aún no hay deudores registrados para este cliente."}
              </Typography>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="text-brand-secondary font-semibold">Nombre</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Ubicación</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Tipificación</TableHead>
                    <TableHead className="text-center text-brand-secondary font-semibold">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDeudores.map((deudor, index) => (
                    <TableRow
                      key={deudor.id}
                      className={cn(
                        "border-brand-secondary/5 transition-colors",
                        index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]",
                        "hover:bg-brand-primary/5"
                      )}
                    >
                      <TableCell className="font-medium text-brand-secondary">
                        {deudor.nombre}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {deudor.ubicacion || "—"}
                      </TableCell>
                      <TableCell>
                        <BadgeTipificacion value={deudor.tipificacion} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => navigate(`/clientes/${clienteId}/deudores/${deudor.id}`)}
                                  className="hover:bg-blue-50 transition-colors"
                                >
                                  <Eye className="h-4 w-4 text-blue-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-brand-secondary text-white">
                                Ver deudor
                              </TooltipContent>
                            </Tooltip>

                            {canEdit && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => iniciarEditar(deudor)}
                                      className="hover:bg-brand-primary/10 transition-colors"
                                      disabled={saving}
                                    >
                                      <Pencil className="h-4 w-4 text-brand-primary" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-brand-secondary text-white">
                                    Editar deudor
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => navigate(`/clientes/${clienteId}/deudores/${deudor.id}/AcuerdoPago`)}
                                      className="hover:bg-green-50 transition-colors"
                                      disabled={saving}
                                    >
                                      <FileText className="h-4 w-4 text-green-600" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-brand-secondary text-white">
                                    Acuerdo de pago
                                  </TooltipContent>
                                </Tooltip>
                              </>
                            )}
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
