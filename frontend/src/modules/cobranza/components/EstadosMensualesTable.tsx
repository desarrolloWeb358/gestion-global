// src/modules/deudores/components/EstadosMensualesTable.tsx
import * as React from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Calendar,
  DollarSign,
  Edit,
  FileText,
  Percent,
  Plus,
  TrendingUp,
  Save,
  Trash2,
} from "lucide-react";

import {
  obtenerEstadosMensuales,
  upsertEstadoMensualPorMes,
  eliminarEstadoMensual,
} from "../services/estadoMensualService";
import { EstadoMensual } from "../models/estadoMensual.model";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/shared/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Textarea } from "@/shared/ui/textarea";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import { Typography } from "@/shared/design-system/components/Typography";
import { BackButton } from "@/shared/design-system/components/BackButton";
import { cn } from "@/shared/lib/cn";

export default function EstadosMensualesTable() {
  const { clienteId, deudorId } = useParams();
  const [estadosMensuales, setEstadosMensuales] = React.useState<EstadoMensual[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Modal & guardado
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Modo edición
  const [editing, setEditing] = React.useState(false);

  // Eliminación
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [estadoToDelete, setEstadoToDelete] = React.useState<EstadoMensual | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const hoyYYYYMM = new Date().toISOString().slice(0, 7);
  const clamp = (n: number, min: number, max: number) =>
    Math.min(max, Math.max(min, n));
  const round0 = (n: number) => Math.round(n);

  const [nuevoEstadoMensual, setNuevoEstadoMensual] =
    React.useState<Partial<EstadoMensual>>({
      mes: hoyYYYYMM,
      clienteUID: clienteId || "",
      deuda: undefined,
      recaudo: undefined,
      porcentajeHonorarios: 15,
      honorariosDeuda: undefined,
      honorariosRecaudo: undefined,
      recibo: "",
      observaciones: "",
    });


  React.useEffect(() => {
    setNuevoEstadoMensual((s) => {
      const pct = (s.porcentajeHonorarios ?? 15) / 100;

      const deudaVal = s.deuda ?? undefined;
      const recaudoVal = s.recaudo ?? undefined;

      const hd = deudaVal != null ? round0(deudaVal * pct) : undefined;

      const recaudoNum = recaudoVal != null ? Number(recaudoVal) : 0;

      const hr = round0(recaudoNum * pct);

      if (
        hd === s.honorariosDeuda &&
        hr === s.honorariosRecaudo
      ) return s;

      return { ...s, honorariosDeuda: hd, honorariosRecaudo: hr };
    });
  }, [
    nuevoEstadoMensual.deuda,
    nuevoEstadoMensual.recaudo,
    nuevoEstadoMensual.porcentajeHonorarios,
  ]);

  const { can, roles = [], loading: aclLoading } = useAcl();

  // Detectar si el usuario actual es deudor
  const esDeudor = roles.includes("deudor");

  // Si es deudor: siempre puede ver, pero nunca editar
  const canView = esDeudor ? true : can(PERMS.Abonos_Read);
  const canEdit =
    !esDeudor && can(PERMS.Abonos_Edit) && !roles.includes("cliente");

  const cargarEstadosMensuales = async () => {
    if (!clienteId || !deudorId) return;

    const data = await obtenerEstadosMensuales(clienteId, deudorId);

    const ordenadosDesc = [...data].sort((a, b) => {
      return b.mes.localeCompare(a.mes);
    });

    setEstadosMensuales(ordenadosDesc);
    setLoading(false);
  };


  React.useEffect(() => {
    cargarEstadosMensuales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, deudorId]);

  const resetForm = () => {
    setNuevoEstadoMensual({
      mes: new Date().toISOString().slice(0, 7),
      clienteUID: clienteId || "",
      deuda: undefined,
      recaudo: undefined,
      porcentajeHonorarios: 15,
      honorariosDeuda: undefined,
      honorariosRecaudo: undefined,
      recibo: "",
      observaciones: "",
    });
    setEditing(false);
  };

  const openEdit = (estado: EstadoMensual) => {
    if (!canEdit) return;
    setNuevoEstadoMensual({
      clienteUID: clienteId || "",
      id: estado.id,
      mes: estado.mes,
      deuda: estado.deuda ?? undefined,
      recaudo: estado.recaudo ?? undefined,
      porcentajeHonorarios: estado.porcentajeHonorarios ?? 15,
      honorariosDeuda: estado.honorariosDeuda ?? undefined,
      honorariosRecaudo: estado.honorariosRecaudo ?? undefined,
      recibo: estado.recibo ?? "",
      observaciones: estado.observaciones ?? "",
    });
    setEditing(true);
    setOpen(true);
  };

  const handleCrearOEditar = async () => {
    if (!canEdit) return toast.error("Sin permiso para guardar.");
    if (!clienteId || !deudorId || !nuevoEstadoMensual.mes) {
      return toast.error("Debe seleccionar el mes.");
    }

    try {
      setSaving(true);

      const pct = (nuevoEstadoMensual.porcentajeHonorarios ?? 15) / 100;

      const deuda = nuevoEstadoMensual.deuda != null ? Math.round(nuevoEstadoMensual.deuda) : undefined;
      const recaudo = nuevoEstadoMensual.recaudo != null ? Math.round(nuevoEstadoMensual.recaudo) : undefined;


      const payload: Partial<EstadoMensual> = {
        ...nuevoEstadoMensual,
        deuda,
        recaudo,

        honorariosDeuda: deuda != null ? Math.round(deuda * pct) : undefined,

        honorariosRecaudo: recaudo != null
          ? Math.round(recaudo * pct)
          : undefined,
      };


      await upsertEstadoMensualPorMes(clienteId, deudorId, payload);

      toast.success(editing ? "Estado mensual actualizado" : "Estado mensual guardado");
      await cargarEstadosMensuales();
      setOpen(false);
      resetForm();
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar el estado mensual");
    } finally {
      setSaving(false);
    }
  };


  const handleEliminarEstado = async () => {
    if (!clienteId || !deudorId || !estadoToDelete?.id) return;

    try {
      setDeleting(true);
      await eliminarEstadoMensual(clienteId, deudorId, estadoToDelete.id);
      toast.success("Estado mensual eliminado");
      await cargarEstadosMensuales();
      setEstadoToDelete(null);
      setDeleteDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Error al eliminar el estado mensual");
    } finally {
      setDeleting(false);
    }
  };

  if (aclLoading) {
    return (
      <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-3" />
        <Typography variant="small" >
          Cargando permisos...
        </Typography>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
        <Typography variant="body">
          No tienes acceso a Abonos.
        </Typography>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-3" />
        <Typography variant="small">
          Cargando estados mensuales...
        </Typography>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <BackButton />

      {/* Header */}
      <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-5 md:p-6 border-b border-brand-secondary/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-brand-primary/10">
                <TrendingUp className="h-6 w-6 text-brand-primary" />
              </div>
              <div>
                <Typography variant="h2" className="!text-brand-secondary">
                  Estados Mensuales del Deudor
                </Typography>
                <Typography variant="small" className="mt-0.5">
                  Seguimiento de deuda, recaudos y honorarios
                </Typography>
              </div>
            </div>

            {canEdit && (
              <Dialog
                open={open}
                onOpenChange={(v) => {
                  setOpen(v);
                  if (!v) resetForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      resetForm();
                      setOpen(true);
                    }}
                    variant="brand"
                    className="gap-2 shadow-md hover:shadow-lg transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar estado mensual
                  </Button>
                </DialogTrigger>

                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-brand-primary text-xl font-bold flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {editing
                        ? `Editar Estado (${nuevoEstadoMensual.mes})`
                        : "Nuevo Estado Mensual"}
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-6 py-4">
                    {/* Mes */}
                    <div className="space-y-2">
                      <Label htmlFor="mes" className="text-brand-secondary font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Mes *
                      </Label>
                      <Input
                        id="mes"
                        type="month"
                        value={nuevoEstadoMensual.mes || ""}
                        onChange={(e) =>
                          setNuevoEstadoMensual((s) => ({
                            ...s,
                            mes: e.target.value,
                          }))
                        }
                        className="border-brand-secondary/30"
                      />
                    </div>

                    {/* Campos numéricos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="deuda" className="text-brand-secondary font-medium flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Deuda
                        </Label>
                        <Input
                          id="deuda"
                          type="number"
                          step="0.01"
                          value={nuevoEstadoMensual.deuda ?? ""}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          onChange={(e) => {
                            const val = e.target.value
                              ? clamp(parseFloat(e.target.value), 0, 1e15)
                              : undefined;
                            setNuevoEstadoMensual((s) => ({
                              ...s,
                              deuda: val,
                            }));
                          }}
                          placeholder="0.00"
                          className="border-brand-secondary/30"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="recaudo" className="text-brand-secondary font-medium flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Recaudo
                        </Label>
                        <Input
                          id="recaudo"
                          type="number"
                          step="0.01"
                          value={nuevoEstadoMensual.recaudo ?? ""}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          onChange={(e) => {
                            const val = e.target.value
                              ? clamp(parseFloat(e.target.value), 0, 1e15)
                              : undefined;
                            setNuevoEstadoMensual((s) => ({
                              ...s,
                              recaudo: val,
                            }));
                          }}
                          placeholder="0.00"
                          className="border-brand-secondary/30"
                        />
                      </div>


                      <div className="space-y-2">
                        <Label htmlFor="porcentaje" className="text-brand-secondary font-medium flex items-center gap-2">
                          <Percent className="h-4 w-4" />
                          % Honorarios
                        </Label>
                        <Input
                          id="porcentaje"
                          type="number"
                          step="0.01"
                          value={nuevoEstadoMensual.porcentajeHonorarios ?? ""}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          onChange={(e) => {
                            const val = e.target.value
                              ? parseFloat(e.target.value)
                              : undefined;
                            setNuevoEstadoMensual((s) => ({
                              ...s,
                              porcentajeHonorarios: val,
                            }));
                          }}
                          placeholder="15"
                          className="border-brand-secondary/30"
                        />
                      </div>
                    </div>

                    {/* Honorarios (solo lectura) */}
                    <div className="rounded-xl border border-brand-secondary/20 bg-brand-primary/5 p-4 space-y-3">
                      <Typography variant="small" className="font-semibold text-brand-secondary">
                        Honorarios calculados automáticamente
                      </Typography>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Hon. Deuda */}
                        <div className="space-y-2">
                          <Label className="text-brand-secondary font-medium">Hon. Deuda</Label>
                          <Input readOnly value={nuevoEstadoMensual.honorariosDeuda != null ? `$${nuevoEstadoMensual.honorariosDeuda.toLocaleString()}` : ""} className="bg-white border-brand-secondary/30 cursor-not-allowed" />
                        </div>


                        {/* Hon. Recaudo */}
                        <div className="space-y-2">
                          <Label className="text-brand-secondary font-medium">Hon. Recaudo</Label>
                          <Input readOnly value={nuevoEstadoMensual.honorariosRecaudo != null ? `$${nuevoEstadoMensual.honorariosRecaudo.toLocaleString()}` : ""} className="bg-white border-brand-secondary/30 cursor-not-allowed" />
                        </div>
                      </div>
                    </div>

                    {/* Recibo */}
                    <div className="space-y-2">
                      <Label htmlFor="recibo" className="text-brand-secondary font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Número de Recibo
                      </Label>
                      <Input
                        id="recibo"
                        value={nuevoEstadoMensual.recibo ?? ""}
                        onChange={(e) =>
                          setNuevoEstadoMensual((s) => ({
                            ...s,
                            recibo: e.target.value,
                          }))
                        }
                        placeholder="Ej: REC-2024-001"
                        className="border-brand-secondary/30"
                      />
                    </div>

                    {/* Observaciones */}
                    <div className="space-y-2">
                      <Label htmlFor="observaciones" className="text-brand-secondary font-medium">
                        Observaciones
                      </Label>
                      <Textarea
                        id="observaciones"
                        value={nuevoEstadoMensual.observaciones ?? ""}
                        onChange={(e) =>
                          setNuevoEstadoMensual((s) => ({
                            ...s,
                            observaciones: e.target.value,
                          }))
                        }
                        placeholder="Notas adicionales sobre este estado mensual..."
                        className="min-h-24 border-brand-secondary/30"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setOpen(false);
                        resetForm();
                      }}
                      disabled={saving}
                      className="border-brand-secondary/30"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCrearOEditar}
                      disabled={saving}
                      variant="brand"
                      className="gap-2"
                    >
                      {saving ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          {editing ? "Actualizar" : "Guardar"}
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </section>

      {/* Tabla */}
      {estadosMensuales.length === 0 ? (
        <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 rounded-full bg-brand-primary/10">
              <TrendingUp className="h-8 w-8 text-brand-primary/60" />
            </div>
            <Typography variant="h3" className="text-brand-secondary">
              No hay registros
            </Typography>
            <Typography variant="small">
              Aún no se han registrado estados mensuales
            </Typography>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                  <TableHead className="text-brand-secondary font-semibold">
                    Mes
                  </TableHead>
                  <TableHead className="text-brand-secondary font-semibold">
                    Deuda
                  </TableHead>
                  <TableHead className="text-brand-secondary font-semibold">
                    Recaudo
                  </TableHead>
                  <TableHead className="text-brand-secondary font-semibold">
                    % Honorarios
                  </TableHead>
                  <TableHead className="text-brand-secondary font-semibold">
                    Hon. Deuda
                  </TableHead>
                  <TableHead className="text-brand-secondary font-semibold">
                    Hon. Recaudo
                  </TableHead>
                  <TableHead className="text-brand-secondary font-semibold">
                    Total con Honorarios
                  </TableHead>
                  {canEdit && (
                    <TableHead className="text-center text-brand-secondary font-semibold">
                      Acciones
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {estadosMensuales.map((estado, index) => (
                  <TableRow
                    key={estado.id ?? `${estado.mes}`}
                    className={cn(
                      "border-brand-secondary/5 transition-colors",
                      index % 2 === 0
                        ? "bg-white"
                        : "bg-brand-primary/[0.02]",
                      "hover:bg-brand-primary/5"
                    )}
                  >
                    <TableCell className="font-medium text-brand-secondary">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {estado.mes}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-700">
                      ${Number(estado.deuda ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-gray-700">
                      ${Number(estado.recaudo ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-gray-700">
                      {Number(
                        estado.porcentajeHonorarios ?? 0
                      ).toLocaleString()}
                      %
                    </TableCell>
                    <TableCell className="text-gray-700">
                      ${Number(estado.honorariosDeuda ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-gray-700">
                      ${Number(estado.honorariosRecaudo ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-gray-700 font-semibold">
                      ${(
                        Number(estado.deuda ?? 0) + Number(estado.honorariosDeuda ?? 0)
                      ).toLocaleString()}
                    </TableCell>

                    {canEdit && (
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(estado)}
                            className="hover:bg-brand-primary/10"
                          >
                            <Edit className="h-4 w-4 text-brand-primary" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEstadoToDelete(estado);
                              setDeleteDialogOpen(true);
                            }}
                            className="hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Dialog de confirmación de eliminación */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setEstadoToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar estado mensual</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar el estado mensual del mes{" "}
              <strong>{estadoToDelete?.mes}</strong>? Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminarEstado}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}