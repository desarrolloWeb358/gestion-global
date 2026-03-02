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
import { cn } from "@/shared/lib/cn";
import AppBreadcrumb from "@/shared/components/app-breadcrumb";
import { getClienteById } from "@/modules/clientes/services/clienteService";
import { getDeudorById } from "../services/deudorService";

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
  const [nombreCliente, setNombreCliente] = React.useState("");
  const [nombreDeudor, setNombreDeudor] = React.useState("");

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
    if (!clienteId || !deudorId) return;

    const fetchData = async () => {
      try {
        const cliente = await getClienteById(clienteId);
        const deudor = await getDeudorById(clienteId, deudorId);

        setNombreCliente(cliente?.nombre ?? "Cliente");
        setNombreDeudor(deudor?.nombre ?? "Deudor");
      } catch (e) {
        console.error("Error cargando breadcrumb:", e);
      }
    };

    fetchData();
  }, [clienteId, deudorId]);
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
      {/* Breadcrumb */}
      <AppBreadcrumb
        items={[
          { label: "Clientes", href: "/clientes-tables" },
          { label: nombreCliente, href: `/deudores/${clienteId}` },
          { label: nombreDeudor, href: `/clientes/${clienteId}/deudores/${deudorId}` },
          { label: "Estados Mensuales" },
        ]}
        className="text-xs text-gray-500"
      />
      {/* Header */}
      <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-5 md:p-6 border-b border-brand-secondary/10">
          <div className="flex flex-col gap-4">



            {/* Título + descripción */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-primary/10">
                  <TrendingUp className="h-6 w-6 text-brand-primary" />
                </div>

                <div>
                  <Typography
                    variant="h2"
                    className="!text-brand-secondary font-bold"
                  >
                    Estados Mensuales
                  </Typography>

                  <Typography
                    variant="small"
                    className="text-gray-600 mt-0.5"
                  >
                    Seguimiento de deuda, recaudos y honorarios
                  </Typography>
                </div>
              </div>

              {canEdit && (
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
              )}
            </div>

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