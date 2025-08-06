import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { obtenerAbonos, crearAbono } from "../services/abonoService";
import { Abono } from "../models/abono.model";
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

export default function AbonosTable() {
  const { clienteId, deudorId } = useParams();
  const [abonos, setAbonos] = useState<Abono[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Formulario abono
  const [nuevoAbono, setNuevoAbono] = useState<Partial<Abono>>({
    monto: 0,
    fecha: new Date().toISOString().split("T")[0],
    tipo: "ordinario",
    recibo: "",
    observaciones: "",
  });

  const cargarAbonos = async () => {
    if (clienteId && deudorId) {
      const data = await obtenerAbonos(clienteId, deudorId);
      setAbonos(data);
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarAbonos();
  }, [clienteId, deudorId]);

  const handleCrearAbono = async () => {
    if (!clienteId || !deudorId || !nuevoAbono.monto || !nuevoAbono.fecha) {
      toast.error("Debe llenar los campos obligatorios");
      return;
    }

    try {
      await crearAbono(clienteId, deudorId, nuevoAbono as Abono);
      toast.success("Abono creado correctamente");
      setNuevoAbono({
        monto: 0,
        fecha: new Date().toISOString().split("T")[0],
        tipo: "ordinario",
        recibo: "",
        observaciones: "",
      });
      cargarAbonos();
    } catch (error) {
      toast.error("Error al guardar el abono");
    }
  };

  if (loading) return <p className="text-center mt-10">Cargando abonos...</p>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
    
        <h2 className="text-3xl font-bold text-center w-full">Abonos</h2>
        <Dialog>
          <DialogTrigger asChild>
            
            <Button className="absolute right-4 top-4">Agregar abono</Button>
            
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo abono</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label>Monto *</Label>
                <Input
                  type="number"
                  value={nuevoAbono.monto}
                  onChange={(e) =>
                    setNuevoAbono({ ...nuevoAbono, monto: parseFloat(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={nuevoAbono.fecha}
                  onChange={(e) => setNuevoAbono({ ...nuevoAbono, fecha: e.target.value })}
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select
                  value={nuevoAbono.tipo}
                  onValueChange={(value) => setNuevoAbono({ ...nuevoAbono, tipo: value as any })}
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
                  value={nuevoAbono.recibo}
                  onChange={(e) => setNuevoAbono({ ...nuevoAbono, recibo: e.target.value })}
                />
              </div>
              <div>
                <Label>Observaciones</Label>
                <Input
                  value={nuevoAbono.observaciones}
                  onChange={(e) =>
                    setNuevoAbono({ ...nuevoAbono, observaciones: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCrearAbono}>Guardar abono</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <table className="w-full text-sm border">
        <thead className="bg-gray-100">
          <tr>
            <th className="text-left p-2">Fecha</th>
            <th className="text-left p-2">Monto</th>
            <th className="text-left p-2">Tipo</th>
            <th className="text-left p-2">Recibo</th>
            <th className="text-left p-2">Observaciones</th>
          </tr>
        </thead>
        <tbody>
          {abonos.map((abono, i) => (
            <tr key={i} className="border-t">
              <td className="p-2">{new Date(abono.fecha).toLocaleDateString()}</td>
              <td className="p-2">${abono.monto.toLocaleString()}</td>
              <td className="p-2 capitalize">{abono.tipo}</td>
              <td className="p-2">{abono.recibo || "-"}</td>
              <td className="p-2">{abono.observaciones || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
