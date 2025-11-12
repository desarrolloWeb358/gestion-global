// src/modules/deudores/components/EstadosMensualesTable.tsx
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  obtenerEstadosMensuales,
  upsertEstadoMensualPorMes,
} from "../services/estadoMensualService";
import { EstadoMensual } from "../models/estadoMensual.model";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/table";
import { toast } from "sonner";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import {
  Calendar,
  DollarSign,
  Edit,
  FileText,
  Percent,
  Plus,
  TrendingUp,
  Save,
} from "lucide-react";
import { BackButton } from "@/shared/design-system/components/BackButton";

export default function EstadosMensualesTable() {
  const { clienteId, deudorId } = useParams();
  const [estadosMensuales, setEstadosMensuales] = useState<EstadoMensual[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal & guardado
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modo edición
  const [editing, setEditing] = useState(false);

  const hoyYYYYMM = new Date().toISOString().slice(0, 7);
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  const [nuevoEstadoMensual, setNuevoEstadoMensual] = useState<Partial<EstadoMensual>>({
    mes: hoyYYYYMM,
    clienteUID: clienteId || "",
    deuda: undefined,
    recaudo: undefined,
    acuerdo: undefined,
    porcentajeHonorarios: 15,
    honorariosDeuda: undefined,
    honorariosAcuerdo: undefined,
    recibo: "",
    observaciones: "",
  });

  // Recalcular honorarios cuando cambien deuda/acuerdo/%
  useEffect(() => {
    setNuevoEstadoMensual((s) => {
      const pct = (s.porcentajeHonorarios ?? 15) / 100;
      const hd = s.deuda != null ? round2((s.deuda as number) * pct) : undefined;
      const ha = s.acuerdo != null ? round2((s.acuerdo as number) * pct) : undefined;
      if (hd === s.honorariosDeuda && ha === s.honorariosAcuerdo) return s;
      return { ...s, honorariosDeuda: hd, honorariosAcuerdo: ha };
    });
  }, [
    nuevoEstadoMensual.deuda,
    nuevoEstadoMensual.acuerdo,
    nuevoEstadoMensual.porcentajeHonorarios
  ]);

  const { can, roles = [], loading: aclLoading } = useAcl();
  const canView = can(PERMS.Abonos_Read);
  const canEdit = can(PERMS.Abonos_Edit) && !roles.includes("cliente");

  const cargarEstadosMensuales = async () => {
    if (!clienteId || !deudorId) return;
    const data = await obtenerEstadosMensuales(clienteId, deudorId);
    setEstadosMensuales(data);
    setLoading(false);
  };

  useEffect(() => {
    cargarEstadosMensuales();
    // eslint-disable-next-line
  }, [clienteId, deudorId]);

  const resetForm = () => {
    setNuevoEstadoMensual({
      mes: new Date().toISOString().slice(0, 7),
      deuda: undefined,
      recaudo: undefined,
      acuerdo: undefined,
      porcentajeHonorarios: 15,
      honorariosDeuda: undefined,
      honorariosAcuerdo: undefined,
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
      acuerdo: estado.acuerdo ?? undefined,
      porcentajeHonorarios: estado.porcentajeHonorarios ?? 15,
      honorariosDeuda: estado.honorariosDeuda ?? undefined,
      honorariosAcuerdo: estado.honorariosAcuerdo ?? undefined,
      recibo: estado.recibo ?? "",
      observaciones: estado.observaciones ?? "",
    });
    setEditing(true);
    setOpen(true);
  };

  const handleCrearOEditar = async () => {
    console.log("Guardando estado mensual:", nuevoEstadoMensual);
    if (!canEdit) return toast.error("Sin permiso para guardar.");
    if (!clienteId || !deudorId || !nuevoEstadoMensual.mes) {
      return toast.error("Debe seleccionar el mes.");
    }
    try {
      setSaving(true);
      await upsertEstadoMensualPorMes(clienteId, deudorId, nuevoEstadoMensual);
      toast.success(editing ? "✓ Estado mensual actualizado" : "✓ Estado mensual guardado");
      await cargarEstadosMensuales();
      setOpen(false);
      resetForm();
    } catch (e) {
      console.error(e);
      toast.error("⚠️ Error al guardar el estado mensual");
    } finally {
      setSaving(false);
    }
  };

  if (aclLoading) {
    return (
      <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-3" />
        <Typography variant="small" className="text-muted">
          Cargando permisos...
        </Typography>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
        <Typography variant="body" className="text-muted">
          No tienes acceso a Abonos.
        </Typography>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-3" />
        <Typography variant="small" className="text-muted">
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand-primary/10">
            <TrendingUp className="h-6 w-6 text-brand-primary" />
          </div>
          <Typography variant="h2" className="!text-brand-secondary">
            Estados Mensuales del Deudor
          </Typography>
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

            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle className="text-brand-primary text-xl font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {editing ? `Editar Estado (${nuevoEstadoMensual.mes})` : "Nuevo Estado Mensual"}
                </DialogTitle>
              </DialogHeader>

              <div className="relative">
                <fieldset disabled={saving} className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                  <div className="col-span-full">
                    <Label className="text-brand-secondary font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Mes *
                    </Label>
                    <Input
                      type="month"
                      value={nuevoEstadoMensual.mes ?? ""}
                      onChange={(e) =>
                        setNuevoEstadoMensual((s) => ({ ...s, mes: e.target.value.slice(0, 7) }))
                      }
                      disabled={editing}
                      className={cn(
                        "border-brand-secondary/30 mt-1.5",
                        editing && "bg-gray-50 cursor-not-allowed"
                      )}
                    />
                  </div>

                  <div>
                    <Label className="text-brand-secondary font-medium flex items-center gap-2">
                      <Percent className="h-4 w-4" />
                      Porcentaje Honorarios
                    </Label>
                    <Input
                      type="number"
                      min={10}
                      max={20}
                      step={1}
                      value={nuevoEstadoMensual.porcentajeHonorarios ?? 15}
                      onChange={(e) => {
                        const raw = e.target.value === "" ? 15 : Number(e.target.value);
                        const clamped = clamp(isNaN(raw) ? 15 : raw, 10, 20);
                        setNuevoEstadoMensual((s) => ({ ...s, porcentajeHonorarios: clamped }));
                      }}
                      className="border-brand-secondary/30 mt-1.5"
                    />
                  </div>

                  <div>
                    <Label className="text-brand-secondary font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Deuda
                    </Label>
                    <Input
                      type="number"
                      value={nuevoEstadoMensual.deuda ?? ""}
                      onChange={(e) =>
                        setNuevoEstadoMensual((s) => ({
                          ...s,
                          deuda: e.target.value === "" ? undefined : Number(e.target.value),
                        }))
                      }
                      className="border-brand-secondary/30 mt-1.5"
                    />
                  </div>

                  <div>
                    <Label className="text-brand-secondary font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Recaudo
                    </Label>
                    <Input
                      type="number"
                      value={nuevoEstadoMensual.recaudo ?? ""}
                      onChange={(e) =>
                        setNuevoEstadoMensual((s) => ({
                          ...s,
                          recaudo: e.target.value === "" ? undefined : Number(e.target.value),
                        }))
                      }
                      className="border-brand-secondary/30 mt-1.5"
                    />
                  </div>

                  <div>
                    <Label className="text-brand-secondary font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Acuerdo
                    </Label>
                    <Input
                      type="number"
                      value={nuevoEstadoMensual.acuerdo ?? ""}
                      onChange={(e) =>
                        setNuevoEstadoMensual((s) => ({
                          ...s,
                          acuerdo: e.target.value === "" ? undefined : Number(e.target.value),
                        }))
                      }
                      className="border-brand-secondary/30 mt-1.5"
                    />
                  </div>

                  <div>
                    <Label className="text-brand-secondary font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Honorarios Deuda
                    </Label>
                    <Input
                      type="number"
                      value={nuevoEstadoMensual.honorariosDeuda ?? ""}
                      readOnly
                      disabled
                      className="bg-gray-50 border-brand-secondary/30 mt-1.5"
                    />
                  </div>

                  <div>
                    <Label className="text-brand-secondary font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Honorarios Acuerdo
                    </Label>
                    <Input
                      type="number"
                      value={nuevoEstadoMensual.honorariosAcuerdo ?? ""}
                      readOnly
                      disabled
                      className="bg-gray-50 border-brand-secondary/30 mt-1.5"
                    />
                  </div>

                  <div>
                    <Label className="text-brand-secondary font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Recibo
                    </Label>
                    <Input
                      value={nuevoEstadoMensual.recibo ?? ""}
                      onChange={(e) => setNuevoEstadoMensual((s) => ({ ...s, recibo: e.target.value }))}
                      className="border-brand-secondary/30 mt-1.5"
                    />
                  </div>

                  <div className="col-span-full">
                    <Label className="text-brand-secondary font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Observaciones
                    </Label>
                    <Input
                      value={nuevoEstadoMensual.observaciones ?? ""}
                      onChange={(e) =>
                        setNuevoEstadoMensual((s) => ({ ...s, observaciones: e.target.value }))
                      }
                      className="border-brand-secondary/30 mt-1.5"
                    />
                  </div>
                </fieldset>

                {saving && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-md">
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-5 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
                      <Typography variant="body" className="font-medium">
                        Guardando...
                      </Typography>
                    </div>
                  </div>
                )}
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
                <Button onClick={handleCrearOEditar} disabled={saving} variant="brand" className="gap-2">
                  {saving ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {editing ? "Guardar cambios" : "Guardar"}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

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
            <Typography variant="small" className="text-muted">
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
                  <TableHead className="text-brand-secondary font-semibold">Mes</TableHead>
                  <TableHead className="text-brand-secondary font-semibold">Deuda</TableHead>
                  <TableHead className="text-brand-secondary font-semibold">Recaudo</TableHead>
                  <TableHead className="text-brand-secondary font-semibold">Acuerdo</TableHead>
                  <TableHead className="text-brand-secondary font-semibold">% Honorarios</TableHead>
                  <TableHead className="text-brand-secondary font-semibold">Hon. Deuda</TableHead>
                  <TableHead className="text-brand-secondary font-semibold">Hon. Acuerdo</TableHead>
                  {canEdit && (
                    <TableHead className="text-center text-brand-secondary font-semibold">Acciones</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {estadosMensuales.map((estado, index) => (
                  <TableRow
                    key={estado.id ?? `${estado.mes}`}
                    className={cn(
                      "border-brand-secondary/5 transition-colors",
                      index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]",
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
                      ${Number(estado.acuerdo ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-gray-700">
                      {Number(estado.porcentajeHonorarios ?? 0).toLocaleString()}%
                    </TableCell>
                    <TableCell className="text-gray-700">
                      ${Number(estado.honorariosDeuda ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-gray-700">
                      ${Number(estado.honorariosAcuerdo ?? 0).toLocaleString()}
                    </TableCell>

                    {canEdit && (
                      <TableCell>
                        <div className="flex justify-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(estado)}
                            className="hover:bg-brand-primary/10"
                          >
                            <Edit className="h-4 w-4 text-brand-primary" />
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
    </div>
  );
}