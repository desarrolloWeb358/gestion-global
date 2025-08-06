import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { obtenerEstadosMensuales, crearEstadoMensual } from "../services/estadoMensualService";
import { EstadoMensual } from "../models/estadoMensual.model";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function EstadosMensualesTable() {
  const { clienteId, deudorId } = useParams();
  const [estadosMensuales, setEstadosMensuales] = useState<EstadoMensual[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Formulario estadoMensual
  const [nuevoEstadoMensual, setNuevoEstadoMensual] = useState<Partial<EstadoMensual>>({
    recaudo: 0,
    fecha: new Date().toISOString().split("T")[0],
    tipo: "ordinario",
    recibo: "",
    observaciones: "",
  });

  const cargarEstadosMensuales = async () => {
    if (clienteId && deudorId) {
      const data = await obtenerEstadosMensuales(clienteId, deudorId);
      setEstadosMensuales(data);
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarEstadosMensuales();
  }, [clienteId, deudorId]);

  const handleCrearEstadoMensual = async () => {
    if (!clienteId || !deudorId || !nuevoEstadoMensual.recaudo || !nuevoEstadoMensual.fecha) {
      toast.error("Debe llenar los campos obligatorios");
      return;
    }

    try {
      await crearEstadoMensual(clienteId, deudorId, nuevoEstadoMensual as EstadoMensual);
      toast.success("EstadoMensual creado correctamente");
      setNuevoEstadoMensual({
        recaudo: 0,
        fecha: new Date().toISOString().split("T")[0],
        tipo: "ordinario",
        recibo: "",
        observaciones: "",
      });
      cargarEstadosMensuales();
    } catch (error) {
      toast.error("Error al guardar el estadoMensual");
    }
  };

  if (loading) return <p className="text-center mt-10">Cargando estadoMensuals...</p>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
    
        <h2 className="text-3xl font-bold text-center w-full">EstadosMensuales</h2>
        <Dialog>
          <DialogTrigger asChild>
            
            <Button className="absolute right-4 top-4">Agregar estadoMensual</Button>
            
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo estadoMensual</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label>recaudo *</Label>
                <Input
                  type="number"
                  value={nuevoEstadoMensual.recaudo}
                  onChange={(e) =>
                    setNuevoEstadoMensual({ ...nuevoEstadoMensual, recaudo: parseFloat(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={nuevoEstadoMensual.fecha}
                  onChange={(e) => setNuevoEstadoMensual({ ...nuevoEstadoMensual, fecha: e.target.value })}
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select
                  value={nuevoEstadoMensual.tipo}
                  onValueChange={(value) => setNuevoEstadoMensual({ ...nuevoEstadoMensual, tipo: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ordinario">Ordinario</SelectItem>
                    <SelectItem value="extraordinario">Extraordinario</SelectItem>
                    <SelectItem value="anticipo">Anticipo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Recibo</Label>
                <Input
                  value={nuevoEstadoMensual.recibo}
                  onChange={(e) => setNuevoEstadoMensual({ ...nuevoEstadoMensual, recibo: e.target.value })}
                />
              </div>
              <div>
                <Label>Observaciones</Label>
                <Input
                  value={nuevoEstadoMensual.observaciones}
                  onChange={(e) =>
                    setNuevoEstadoMensual({ ...nuevoEstadoMensual, observaciones: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCrearEstadoMensual}>Guardar estadoMensual</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <table className="w-full text-sm border">
        <thead className="bg-gray-100">
          <tr>
            <th className="text-left p-2">Fecha</th>
            <th className="text-left p-2">Recaudo</th>
            <th className="text-left p-2">Tipo</th>
            <th className="text-left p-2">Recibo</th>
            <th className="text-left p-2">Observaciones</th>
          </tr>
        </thead>
        <tbody>
          {estadosMensuales.map((estadoMensual, i) => (
            <tr key={i} className="border-t">
              <td className="p-2">{new Date(estadoMensual.fecha).toLocaleDateString()}</td>
              <td className="p-2">${estadoMensual.recaudo.toLocaleString()}</td>
              <td className="p-2 capitalize">{estadoMensual.tipo}</td>
              <td className="p-2">{estadoMensual.recibo || "-"}</td>
              <td className="p-2">{estadoMensual.observaciones || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

