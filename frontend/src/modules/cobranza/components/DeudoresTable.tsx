import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Eye, Pencil, Search, X, Users, UserPlus, Filter, FileText, Trash2, CalendarIcon } from "lucide-react";
import { createPortal } from "react-dom";

import { Deudor } from "../models/deudores.model";
import {
  obtenerDeudorPorCliente,
  crearDeudor,
  actualizarDeudorDatos,
  borrarDeudorCompleto
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

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// 🔐 ACL
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";

// ✅ Historial tipificaciones
import type { HistorialTipificacion } from "../models/historialTipificacion.model";

import { Timestamp } from "firebase/firestore";

import {
  obtenerHistorialTipificaciones,
  reemplazarHistorialTipificaciones,
  tipificacionActivaDesdeHistorial,
} from "../services/historialTipificacionesService";

const ALL = "__ALL__";

/** Timestamp-like -> Date */
const toDateSafe = (v: any): Date | undefined => {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate(); // Firestore Timestamp
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  return undefined;
};

function applyHonorariosDefaultByTip(tip: TipificacionDeuda, prev?: number | string) {
  const esDemanda =
    tip === TipificacionDeuda.DEMANDA ||
    tip === TipificacionDeuda.DEMANDA_ACUERDO ||
    tip === TipificacionDeuda.DEMANDA_TERMINADO ||
    tip === TipificacionDeuda.DEMANDA_INSOLVENCIA;

  const current = prev === "" || prev === undefined || prev === null ? undefined : Number(prev);
  if (esDemanda) return 20;
  return Number.isFinite(current as any) ? Number(current) : 15;
}

/* =========================
   Popup: Editor Historial
========================= */

function HistorialTipificacionesDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  readOnly: boolean;
  saving: boolean;
  clienteId: string;
  deudorId: string;
  onSaved: (historialOrdenado: Array<{ fecha: Date; tipificacion: TipificacionDeuda }>) => void;
}) {
  const { open, onOpenChange, readOnly, saving, clienteId, deudorId, onSaved } = props;

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Array<{ id?: string; fecha: Date; tipificacion: TipificacionDeuda }>>([]);
  const [busy, setBusy] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const raw = await obtenerHistorialTipificaciones(clienteId, deudorId);
      const mapped = raw
        .map((x) => ({
          id: x.id,
          fecha: toDateSafe(x.fecha) ?? new Date(),
          tipificacion: (x.tipificacion ?? TipificacionDeuda.GESTIONANDO) as TipificacionDeuda,
        }))
        .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
      setItems(mapped);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error cargando historial");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && clienteId && deudorId) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clienteId, deudorId]);

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      {
        fecha: new Date(),
        tipificacion: TipificacionDeuda.GESTIONANDO,
      },
    ]);
  };

  const updateRow = (idx: number, patch: Partial<{ fecha: Date; tipificacion: TipificacionDeuda }>) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );
  };

  const removeRow = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const guardar = async () => {
    if (readOnly) return;

    // Validación mínima
    if (items.length === 0) {
      toast.error("Debes tener al menos 1 registro de tipificación.");
      return;
    }
    for (const it of items) {
      if (!it.fecha || isNaN(it.fecha.getTime())) {
        toast.error("Hay un registro con fecha inválida.");
        return;
      }
      if (!it.tipificacion) {
        toast.error("Hay un registro sin tipificación.");
        return;
      }
    }

    // Ordenar por fecha asc
    const ordenado = [...items].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    setBusy(true);
    try {
      // Reemplazar el historial completo
      await reemplazarHistorialTipificaciones(
        clienteId,
        deudorId,
        ordenado.map((x) => ({
          fecha: Timestamp.fromDate(x.fecha),
          tipificacion: x.tipificacion
        }))

      );

      toast.success("Historial de tipificaciones guardado.");
      onSaved(ordenado);
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error guardando historial");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && !busy && onOpenChange(v)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-brand-primary text-xl font-bold">
            Historial de tipificaciones
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center">
            <div className="h-10 w-10 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-3" />
            <Typography variant="body">Cargando historial...</Typography>
          </div>
        ) : (
          <div className="space-y-4">
           

            <div className="overflow-x-auto rounded-lg border border-brand-secondary/10">
              <Table>
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="text-brand-secondary font-semibold w-56">Fecha inicio</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Tipificación</TableHead>
                    <TableHead className="text-brand-secondary font-semibold text-center w-24">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, idx) => (
                    <TableRow key={it.id ?? idx} className="border-brand-secondary/5">
                      <TableCell className="align-top">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal border-brand-secondary/30",
                                !it.fecha && "text-muted-foreground"
                              )}
                              disabled={readOnly || busy || saving}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {it.fecha ? format(it.fecha, "PPP", { locale: es }) : "Selecciona fecha"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={it.fecha}
                              defaultMonth={it.fecha ?? new Date()}
                              onSelect={(date) => updateRow(idx, { fecha: date ?? new Date() })}
                              initialFocus
                              captionLayout="dropdown"
                              fromYear={new Date().getFullYear() - 20}
                              toYear={new Date().getFullYear() + 20}
                            />
                          </PopoverContent>
                        </Popover>
                      </TableCell>

                      <TableCell className="align-top">
                        <Select
                          disabled={readOnly || busy || saving}
                          value={it.tipificacion}
                          onValueChange={(v) => updateRow(idx, { tipificacion: v as TipificacionDeuda })}
                        >
                          <SelectTrigger className="border-brand-secondary/30 bg-white focus:border-brand-primary focus:ring-brand-primary/20">
                            <SelectValue placeholder="Selecciona una tipificación" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.values(TipificacionDeuda).map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        
                      </TableCell>

                      <TableCell className="text-center align-top">
                        {!readOnly && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="hover:bg-red-50"
                            onClick={() => removeRow(idx)}
                            disabled={busy || saving}
                            title="Eliminar fila"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No hay historial. Agrega el primer registro.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {!readOnly && (
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addRow}
                  disabled={busy || saving}
                  className="border-brand-secondary/30"
                >
                  + Agregar registro
                </Button>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={busy || saving}
                    className="border-brand-secondary/30"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="brand"
                    onClick={guardar}
                    disabled={busy || saving}
                  >
                    Guardar historial
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {readOnly && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* =========================
   Página principal
========================= */

export default function DeudoresTable() {
  const navigate = useNavigate();
  const { clienteId } = useParams<{ clienteId: string }>();

  const { can, loading: aclLoading } = useAcl();
  const canView = can(PERMS.Deudores_Read);
  const canEdit = can(PERMS.Deudores_Edit);
  const readOnly = !canEdit && canView;

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deudorAEliminar, setDeudorAEliminar] = useState<Deudor | null>(null);
  const [busyAction, setBusyAction] = useState<"save" | "delete" | null>(null);

  const [deudores, setDeudores] = useState<Deudor[]>([]);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [deudorEditando, setDeudorEditando] = useState<Deudor | null>(null);
  const [formData, setFormData] = useState<Partial<Deudor> & { porcentajeHonorarios?: number | string }>({});

  // ✅ BLOQUEO GLOBAL
  const [saving, setSaving] = useState(false);

  // cliente / usuarios
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [nombreCliente, setNombreCliente] = useState<string>("Cargando...");

  const [search, setSearch] = useState("");
  const [tipFilter, setTipFilter] = useState<string>(ALL);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 300;

  // ✅ Popup historial tipificaciones
  const [histOpen, setHistOpen] = useState(false);
  const [deudorHistId, setDeudorHistId] = useState<string | null>(null);

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

  const EXCLUIR_EN_ACTIVOS = new Set<TipificacionDeuda>([
    TipificacionDeuda.INACTIVO,
    TipificacionDeuda.TERMINADO,
    TipificacionDeuda.DEMANDA_TERMINADO,
  ]);

  const filteredDeudores = deudores
    .filter((d) => {
      if (normalizedQ) {
        const hay = `${d.nombre ?? ""} ${d.cedula ?? ""} ${d.ubicacion ?? ""}`.toLowerCase();
        if (!hay.includes(normalizedQ)) return false;
      }

      const tip = d.tipificacion as TipificacionDeuda;
      if (tipFilter === ALL) {
        if (EXCLUIR_EN_ACTIVOS.has(tip)) return false;
      } else {
        if (String(tip) !== tipFilter) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const ua = (a.ubicacion ?? "").trim();
      const ub = (b.ubicacion ?? "").trim();

      if (!ua && ub) return 1;
      if (ua && !ub) return -1;
      if (!ua && !ub) return 0;

      return ua.localeCompare(ub, "es", { sensitivity: "base", numeric: true });
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

  const abrirHistorial = async () => {
    if (!clienteId) return;

    // ✅ si es crear (aún no existe deudor), primero obligamos a guardar el deudor
    if (!deudorEditando?.id) {
      toast.error("Primero crea el deudor para poder editar su historial de tipificaciones.");
      return;
    }

    setDeudorHistId(deudorEditando.id);
    setHistOpen(true);
  };

  const eliminarDeudor = async () => {
    if (!clienteId || !deudorAEliminar?.id) return;
    if (!canEdit) return;

    setBusyAction("delete");
    setSaving(true);

    try {
      await borrarDeudorCompleto(clienteId, deudorAEliminar.id);
      toast.success("✓ Deudor eliminado junto con toda su información asociada.");
      setConfirmDeleteOpen(false);
      setDeudorAEliminar(null);
      await fetchDeudores();
    } catch (e: any) {
      console.error("Eliminar deudor error:", e);
      const code = e?.code;
      const msg = e?.message;
      toast.error(code ? `${code}: ${msg}` : (msg ?? "Error interno"));
    } finally {
      setSaving(false);
      setBusyAction(null);
    }
  };

  const guardarDeudor = async () => {
    if (!clienteId) return;
    if (!canEdit) return;

    const valorActual = formData.porcentajeHonorarios as number | string | undefined;
    const porcentajeFinal =
      valorActual === undefined || valorActual === null || valorActual === ""
        ? 15
        : Number(valorActual);

    setBusyAction("save");
    setSaving(true);

    try {
      // ✅ tipificacion se guarda como la que esté actualmente en formData
      // (y el historial dialog se encarga de actualizarla al guardar historial)
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
        toast.success("Deudor actualizado correctamente");
      } else {
        await crearDeudor(clienteId, {
          nombre: formData.nombre ?? "",
          cedula: formData.cedula,
          ubicacion: formData.ubicacion,
          porcentajeHonorarios: porcentajeFinal,
          correos: formData.correos ?? [],
          telefonos: formData.telefonos ?? [],
          tipificacion: (formData.tipificacion as TipificacionDeuda) ?? TipificacionDeuda.GESTIONANDO,
        });
        toast.success("Deudor creado correctamente");
      }

      setOpen(false);
      await fetchDeudores();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message ?? "Error al guardar el deudor");
    } finally {
      setSaving(false);
      setBusyAction(null);
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

  // ✅ Overlay global (portal)
  const GlobalBlockingOverlay = saving
    ? createPortal(
      <div className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-sm flex items-center justify-center">
        <div className="rounded-xl bg-white shadow-xl px-6 py-5 flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
          <Typography variant="body" className="font-medium">
            {busyAction === "delete"
              ? "Eliminando deudor y toda su información..."
              : deudorEditando
                ? "Guardando cambios..."
                : "Creando deudor..."}
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

                        {/* ✅ TIPIFICACIÓN (solo lectura) + botón editar historial */}
                        <div>
                          <Label className="text-brand-secondary font-medium">Tipificación</Label>

                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex-1 rounded-md border border-brand-secondary/30 bg-white px-3 py-2">
                              <div className="flex items-center gap-2">
                                
                                <span className="text-sm text-brand-secondary font-medium">
                                  {(formData.tipificacion as TipificacionDeuda) ?? TipificacionDeuda.GESTIONANDO}
                                </span>
                              </div>
                              
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              className="border-brand-secondary/30"
                              onClick={abrirHistorial}
                              disabled={readOnly || saving || !deudorEditando?.id}
                              title={!deudorEditando?.id ? "Primero guarda el deudor" : "Editar historial de tipificaciones"}
                            >
                              Editar
                            </Button>
                          </div>

                          {!deudorEditando?.id && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Para editar el historial, primero debes crear el deudor.
                            </p>
                          )}
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
                        <p className="text-xs text-muted-foreground mt-1">
                          Tipificaciones de DEMANDA suelen usar 20%.
                        </p>
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

                  {/* ✅ Popup historial */}
                  {clienteId && deudorEditando?.id && (
                    <HistorialTipificacionesDialog
                      open={histOpen}
                      onOpenChange={setHistOpen}
                      readOnly={readOnly}
                      saving={saving}
                      clienteId={clienteId}
                      deudorId={deudorEditando.id}
                      onSaved={async (historialOrdenado) => {
                        // 1) calcular tipificación activa (última)
                        const tipActiva = tipificacionActivaDesdeHistorial(
                          historialOrdenado.map((h) => ({
                            fecha: Timestamp.fromDate(h.fecha),
                            tipificacion: h.tipificacion
                          }))
                        );

                        // 2) reflejar en el form
                        setFormData((p) => ({
                          ...p,
                          tipificacion: tipActiva,
                          porcentajeHonorarios: applyHonorariosDefaultByTip(tipActiva, p.porcentajeHonorarios),
                        }));

                        // 3) persistir la tipificación activa en el documento deudor
                        try {
                          await actualizarDeudorDatos(clienteId, deudorEditando.id!, {
                            tipificacion: tipActiva,
                            porcentajeHonorarios: applyHonorariosDefaultByTip(tipActiva, formData.porcentajeHonorarios),
                          });
                          await fetchDeudores();
                        } catch (e: any) {
                          console.error(e);
                          toast.error(e?.message ?? "No se pudo actualizar la tipificación del deudor.");
                        }
                      }}
                    />
                  )}

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
                    <SelectItem value={ALL}>Todos (Activos)</SelectItem>
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

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        setDeudorAEliminar(deudor);
                                        setConfirmDeleteOpen(true);
                                      }}
                                      className="hover:bg-red-50 transition-colors"
                                      disabled={saving}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>

                                  </TooltipTrigger>
                                  <TooltipContent className="bg-brand-secondary text-white">
                                    Eliminar
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

              <Dialog
                open={confirmDeleteOpen}
                onOpenChange={(v) => !saving && setConfirmDeleteOpen(v)}
              >
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="text-red-700 text-lg font-bold">
                      Confirmar eliminación definitiva
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-3 text-sm">
                    <p>
                      Vas a eliminar el deudor{" "}
                      <span className="font-semibold">
                        {deudorAEliminar?.nombre ?? "—"}
                      </span>.
                    </p>

                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                      <p className="font-semibold">Atención:</p>
                      <p>Esta acción eliminará definitivamente:</p>
                      <ul className="list-disc ml-5 mt-2 space-y-1">
                        <li>El deudor</li>
                        <li>Todo el seguimiento</li>
                        <li>Estados mensuales</li>
                        <li>Acuerdos de pago</li>
                        <li>Cualquier subcolección asociada</li>
                      </ul>
                      <p className="mt-2 font-semibold">
                        Esta acción no se puede deshacer.
                      </p>
                    </div>
                  </div>

                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setConfirmDeleteOpen(false)}
                      disabled={saving}
                    >
                      Cancelar
                    </Button>

                    <Button
                      className="text-white bg-red-600 hover:bg-red-700"
                      onClick={eliminarDeudor}
                      disabled={saving || !deudorAEliminar?.id}
                    >
                      Sí, borrar definitivamente
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
