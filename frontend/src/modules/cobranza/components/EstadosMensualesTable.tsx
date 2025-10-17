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
import { toast } from "sonner";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";

export default function EstadosMensualesTable() {
  const { clienteId, deudorId } = useParams();
  const [estadosMensuales, setEstadosMensuales] = useState<EstadoMensual[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal & guardado
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // NUEVO: modo edición
  const [editing, setEditing] = useState(false);

  const hoyYYYYMM = new Date().toISOString().slice(0, 7);
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  const [nuevoEstadoMensual, setNuevoEstadoMensual] = useState<Partial<EstadoMensual>>({
    mes: hoyYYYYMM,
    deuda: undefined,
    recaudo: undefined,
    acuerdo: undefined,
    porcentajeHonorarios: 15,
    honorariosDeuda: undefined,
    honorariosAcuerdo: undefined,
    recibo: "",
    observaciones: "",
  });

  // Recalcular honorarios cuando cambien deuda/acuerdo/% (migrado a acuerdo)
  useEffect(() => {
    setNuevoEstadoMensual((s) => {
      const pct = (s.porcentajeHonorarios ?? 15) / 100;
      const hd = s.deuda   != null ? round2((s.deuda   as number) * pct) : undefined;
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
  useEffect(() => { cargarEstadosMensuales(); /* eslint-disable-next-line */ }, [clienteId, deudorId]);

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

  // NUEVO: abrir modal en modo edición con datos precargados
  const openEdit = (estado: EstadoMensual) => {
    if (!canEdit) return;
    setNuevoEstadoMensual({
      // si tu modelo trae id y tu servicio lo utiliza, lo pasamos; si no, no afecta
      id: estado.id,
      mes: estado.mes, // clave lógica; lo dejamos bloqueado en edición
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
    if (!canEdit) return toast.error("Sin permiso para guardar.");
    if (!clienteId || !deudorId || !nuevoEstadoMensual.mes) {
      return toast.error("Debe seleccionar el mes.");
    }
    try {
      setSaving(true);
      // upsert por mes (y/o id si tu servicio lo contempla)
      await upsertEstadoMensualPorMes(clienteId, deudorId, nuevoEstadoMensual);
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

  if (aclLoading) return <p className="text-center mt-10 text-sm text-muted-foreground">Cargando permisos…</p>;
  if (!canView) return <p className="text-center mt-10 text-sm text-muted-foreground">No tienes acceso a Abonos.</p>;
  if (loading) return <p className="text-center mt-10">Cargando estados mensuales...</p>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Estados Mensuales del Deudor</h2>

        {canEdit && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setOpen(true); }}>Agregar estado mensual</Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editing ? `Editar Estado (${nuevoEstadoMensual.mes})` : "Nuevo Estado Mensual"}
                </DialogTitle>
              </DialogHeader>

              <div className="relative">
                <fieldset disabled={saving} className="grid grid-cols-2 gap-4 py-4">
                  <div className="col-span-2">
                    <Label>Mes *</Label>
                    <Input
                      type="month"
                      value={nuevoEstadoMensual.mes ?? ""}
                      onChange={(e) =>
                        setNuevoEstadoMensual((s) => ({ ...s, mes: e.target.value.slice(0, 7) }))
                      }
                      disabled={editing} // bloqueado en edición
                    />
                  </div>

                  <div>
                    <Label>Porcentaje Honorarios</Label>
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
                    />
                  </div>

                  <div>
                    <Label>Deuda</Label>
                    <Input
                      type="number"
                      value={nuevoEstadoMensual.deuda ?? ""}
                      onChange={(e) =>
                        setNuevoEstadoMensual((s) => ({
                          ...s,
                          deuda: e.target.value === "" ? undefined : Number(e.target.value),
                        }))
                      }
                    />
                  </div>

                  <div>
                    <Label>Recaudo</Label>
                    <Input
                      type="number"
                      value={nuevoEstadoMensual.recaudo ?? ""}
                      onChange={(e) =>
                        setNuevoEstadoMensual((s) => ({
                          ...s,
                          recaudo: e.target.value === "" ? undefined : Number(e.target.value),
                        }))
                      }
                    />
                  </div>

                  <div>
                    <Label>Acuerdo</Label>
                    <Input
                      type="number"
                      value={nuevoEstadoMensual.acuerdo ?? ""}
                      onChange={(e) =>
                        setNuevoEstadoMensual((s) => ({
                          ...s,
                          acuerdo: e.target.value === "" ? undefined : Number(e.target.value),
                        }))
                      }
                    />
                  </div>

                  <div>
                    <Label>Honorarios Deuda</Label>
                    <Input type="number" value={nuevoEstadoMensual.honorariosDeuda ?? ""} readOnly disabled />
                  </div>

                  <div>
                    <Label>Honorarios Acuerdo</Label>
                    <Input type="number" value={nuevoEstadoMensual.honorariosAcuerdo ?? ""} readOnly disabled />
                  </div>

                  <div>
                    <Label>Recibo</Label>
                    <Input
                      value={nuevoEstadoMensual.recibo ?? ""}
                      onChange={(e) => setNuevoEstadoMensual((s) => ({ ...s, recibo: e.target.value }))}
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Observaciones</Label>
                    <Input
                      value={nuevoEstadoMensual.observaciones ?? ""}
                      onChange={(e) => setNuevoEstadoMensual((s) => ({ ...s, observaciones: e.target.value }))}
                    />
                  </div>
                </fieldset>

                {saving && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm rounded-md">
                    <span className="text-sm font-medium">Guardando…</span>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button onClick={handleCrearOEditar} disabled={saving}>
                  {saving ? "Guardando…" : editing ? "Guardar cambios" : "Guardar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <table className="w-full text-sm border">
        <thead className="bg-gray-100">
          <tr>
            <th className="text-left p-2">Mes</th>
            <th className="text-left p-2">Deuda</th>
            <th className="text-left p-2">Recaudo</th>
            <th className="text-left p-2">Acuerdo</th>
            <th className="text-left p-2">% Honorarios</th>
            <th className="text-left p-2">Hon. Deuda</th>
            <th className="text-left p-2">Hon. Acuerdo</th>
            {canEdit && <th className="text-left p-2">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {estadosMensuales.map((estado) => (
            <tr key={estado.id ?? `${estado.mes}`}>
              <td className="p-2">{estado.mes}</td>
              <td className="p-2">${Number(estado.deuda ?? 0).toLocaleString()}</td>
              <td className="p-2">${Number(estado.recaudo ?? 0).toLocaleString()}</td>
              <td className="p-2">${Number(estado.acuerdo ?? 0).toLocaleString()}</td>
              <td className="p-2">{Number(estado.porcentajeHonorarios ?? 0).toLocaleString()}%</td>
              <td className="p-2">${Number(estado.honorariosDeuda ?? 0).toLocaleString()}</td>
              <td className="p-2">${Number(estado.honorariosAcuerdo ?? 0).toLocaleString()}</td>

              {canEdit && (
                <td className="p-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openEdit(estado)}
                  >
                    Editar
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
