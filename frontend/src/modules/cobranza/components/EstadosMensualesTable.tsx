import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { obtenerEstadosMensuales, crearEstadoMensual } from "../services/estadoMensualService";
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
import { toast } from "sonner";

// ⬇️ RBAC
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";

export default function EstadosMensualesTable() {
  const { clienteId, deudorId } = useParams();
  const [estadosMensuales, setEstadosMensuales] = useState<EstadoMensual[]>([]);
  const [loading, setLoading] = useState(true);

  const [nuevoEstadoMensual, setNuevoEstadoMensual] = useState<Partial<EstadoMensual>>({
    mes: new Date().toISOString().slice(0, 7), // "YYYY-MM"
    recaudo: 0,
    honorarios: 0,
    recibo: "",
    observaciones: "",
  });

  // RBAC
  const { can, roles = [], loading: aclLoading } = useAcl();
  const canView = can(PERMS.Abonos_Read);
  const canEdit = can(PERMS.Abonos_Edit);
  const isCliente = roles.includes("cliente");
  const canEditSafe = canEdit && !isCliente; // cliente = solo lectura

  const cargarEstadosMensuales = async () => {
    if (clienteId && deudorId) {
      const data = await obtenerEstadosMensuales(clienteId, deudorId);
      setEstadosMensuales(data);
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarEstadosMensuales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, deudorId]);

  const handleCrearEstadoMensual = async () => {
    if (!canEditSafe) {
      toast.error("No tienes permiso para crear estados mensuales.");
      return;
    }

    if (!clienteId || !deudorId || !nuevoEstadoMensual.mes || nuevoEstadoMensual.recaudo === undefined) {
      toast.error("Debe llenar los campos obligatorios");
      return;
    }

    try {
      await crearEstadoMensual(clienteId, deudorId, nuevoEstadoMensual as EstadoMensual);
      toast.success("Estado mensual creado");
      setNuevoEstadoMensual({
        mes: new Date().toISOString().slice(0, 7),
        recaudo: 0,
        honorarios: 0,
        recibo: "",
        observaciones: "",
      });
      cargarEstadosMensuales();
    } catch (error) {
      toast.error("Error al guardar el estado mensual");
    }
  };

  if (aclLoading) return <p className="text-center mt-10 text-sm text-muted-foreground">Cargando permisos…</p>;
  if (!canView)    return <p className="text-center mt-10 text-sm text-muted-foreground">No tienes acceso a Abonos.</p>;
  if (loading)     return <p className="text-center mt-10">Cargando estados mensuales...</p>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Estados Mensuales del Deudor</h2>

        {/* Botón “Agregar estado mensual” solo si tiene permiso de edición */}
        {canEditSafe && (
          <Dialog>
            <DialogTrigger asChild>
              <Button>Agregar estado mensual</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo Estado Mensual</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4 py-4">
                <div>
                  <Label>Mes *</Label>
                  <Input
                    type="month"
                    value={nuevoEstadoMensual.mes}
                    onChange={(e) => setNuevoEstadoMensual({ ...nuevoEstadoMensual, mes: e.target.value })}
                    disabled={!canEditSafe}
                  />
                </div>

                <div>
                  <Label>Deuda</Label>
                  <Input
                    type="number"
                    value={nuevoEstadoMensual.deuda ?? 0}
                    onChange={(e) =>
                      setNuevoEstadoMensual({ ...nuevoEstadoMensual, deuda: parseFloat(e.target.value || "0") })
                    }
                    disabled={!canEditSafe}
                  />
                </div>

                <div>
                  <Label>Recaudo *</Label>
                  <Input
                    type="number"
                    value={nuevoEstadoMensual.recaudo ?? 0}
                    onChange={(e) =>
                      setNuevoEstadoMensual({ ...nuevoEstadoMensual, recaudo: parseFloat(e.target.value || "0") })
                    }
                    disabled={!canEditSafe}
                  />
                </div>

                <div>
                  <Label>Honorarios</Label>
                  <Input
                    type="number"
                    value={nuevoEstadoMensual.honorarios ?? 0}
                    onChange={(e) =>
                      setNuevoEstadoMensual({ ...nuevoEstadoMensual, honorarios: parseFloat(e.target.value || "0") })
                    }
                    disabled={!canEditSafe}
                  />
                </div>

                <div>
                  <Label>Recibo</Label>
                  <Input
                    value={nuevoEstadoMensual.recibo ?? ""}
                    onChange={(e) => setNuevoEstadoMensual({ ...nuevoEstadoMensual, recibo: e.target.value })}
                    disabled={!canEditSafe}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Observaciones</Label>
                  <Input
                    value={nuevoEstadoMensual.observaciones ?? ""}
                    onChange={(e) =>
                      setNuevoEstadoMensual({ ...nuevoEstadoMensual, observaciones: e.target.value })
                    }
                    disabled={!canEditSafe}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button onClick={handleCrearEstadoMensual} disabled={!canEditSafe}>
                  Guardar
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
            <th className="text-left p-2">Honorarios</th>
            <th className="text-left p-2">Recibo</th>
            <th className="text-left p-2">Observaciones</th>
          </tr>
        </thead>
        <tbody>
          {estadosMensuales.map((estado, i) => (
            <tr key={i} className="border-t">
              <td className="p-2">{estado.mes}</td>
              <td className="p-2">${(estado.deuda ?? 0).toLocaleString()}</td>
              <td className="p-2">${(estado.recaudo ?? 0).toLocaleString()}</td>
              <td className="p-2">${(estado.honorarios ?? 0).toLocaleString()}</td>
              <td className="p-2">{estado.recibo || "-"}</td>
              <td className="p-2">{estado.observaciones || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
