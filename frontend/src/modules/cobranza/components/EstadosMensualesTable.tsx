// src/modules/deudores/components/EstadosMensualesTable.tsx
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  obtenerEstadosMensuales,
  upsertEstadoMensualPorMes,   // 👈 nuevo
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

  const hoyYYYYMM = new Date().toISOString().slice(0, 7);
  const [nuevoEstadoMensual, setNuevoEstadoMensual] = useState<Partial<EstadoMensual>>({
    mes: hoyYYYYMM,
    deuda: undefined,
    recaudo: undefined,
    honorarios: undefined,
    recibo: "",
    observaciones: "",
  });

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

  const handleCrearEstadoMensual = async () => {
    if (!canEdit) return toast.error("Sin permiso para crear.");
    if (!clienteId || !deudorId || !nuevoEstadoMensual.mes) {
      return toast.error("Debe seleccionar el mes.");
    }
    try {
      await upsertEstadoMensualPorMes(clienteId, deudorId, nuevoEstadoMensual);
      toast.success("Estado mensual guardado");
      setNuevoEstadoMensual({
        mes: new Date().toISOString().slice(0, 7),
        deuda: undefined,
        recaudo: undefined,
        honorarios: undefined,
        recibo: "",
        observaciones: "",
      });
      await cargarEstadosMensuales();
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar el estado mensual");
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
          
          <Dialog>
            <DialogTrigger asChild>
              
              <Button>Agregar estado mensual</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo Estado Mensual</DialogTitle></DialogHeader>

              <div className="grid grid-cols-2 gap-4 py-4">
                <div>
                  <Label>Mes *</Label>
                  <Input
                    type="month"
                    value={nuevoEstadoMensual.mes ?? ""}
                    onChange={(e) =>
                      setNuevoEstadoMensual((s) => ({ ...s, mes: e.target.value.slice(0, 7) }))
                    }
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
                  <Label>Honorarios</Label>
                  <Input
                    type="number"
                    value={nuevoEstadoMensual.honorarios ?? ""}
                    onChange={(e) =>
                      setNuevoEstadoMensual((s) => ({
                        ...s,
                        honorarios: e.target.value === "" ? undefined : Number(e.target.value),
                      }))
                    }
                  />
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
              </div>

              <DialogFooter>
                <Button onClick={handleCrearEstadoMensual}>Guardar</Button>
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
            <th className="text-left p-2">Honorarios</th>
            <th className="text-left p-2">Recibo</th>
            <th className="text-left p-2">Observaciones</th>
          </tr>
        </thead>
        <tbody>
          {estadosMensuales.map((estado) => (
            <tr key={estado.id ?? `${estado.mes}`}>
              <td className="p-2">{estado.mes}</td>
              <td className="p-2">${Number(estado.deuda ?? 0).toLocaleString()}</td>
              <td className="p-2">${Number(estado.recaudo ?? 0).toLocaleString()}</td>
              <td className="p-2">${Number(estado.honorarios ?? 0).toLocaleString()}</td>
              <td className="p-2">{estado.recibo || "-"}</td>
              <td className="p-2">{estado.observaciones || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
