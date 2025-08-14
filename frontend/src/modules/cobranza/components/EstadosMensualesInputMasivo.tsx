import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Deudor } from "../models/deudores.model";
import { EstadoMensual } from "../models/estadoMensual.model";
import { obtenerDeudorPorCliente, crearEstadoMensual } from "../services/deudorService";
// Si ya tienes un servicio para cliente, úsalo. De lo contrario, implementa este import y función.
import { db } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";

interface FilaEstadoBase {
  deudorId: string;
  nombre: string;
  porcentajeHonorarios: number;
  deuda: number;
  recaudo: number;
}

export default function EstadosMensualesInputMasivo() {
  const { clienteId } = useParams();
  const navigate = useNavigate();

  const [clienteNombre, setClienteNombre] = useState<string>("");
  const [mesGlobal, setMesGlobal] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [filas, setFilas] = useState<FilaEstadoBase[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar nombre del cliente (conjunto)
  useEffect(() => {
    if (!clienteId) return;

    (async () => {
      try {
        // Si tienes un servicio como obtenerClientePorId, úsalo aquí en vez de Firestore directo.
        const ref = doc(db, "clientes", clienteId);
        const snap = await getDoc(ref);
        const nombre = snap.exists() ? (snap.data().nombre as string) : "Cliente";
        setClienteNombre(nombre || "Cliente");
      } catch {
        setClienteNombre("Cliente");
      }
    })();
  }, [clienteId]);

  // Cargar deudores y preparar filas
  useEffect(() => {
    if (!clienteId) return;

    obtenerDeudorPorCliente(clienteId).then((deudores: Deudor[]) => {
      const nuevasFilas: FilaEstadoBase[] = deudores.map((d) => ({
        deudorId: d.id!,
        nombre: d.nombre || "Sin nombre",
        porcentajeHonorarios: d.porcentajeHonorarios || 0,
        deuda: undefined as unknown as number,
        recaudo: undefined as unknown as number,
      }));
      setFilas(nuevasFilas);
      setLoading(false);
    });
  }, [clienteId]);

  const handleChange = (index: number, field: keyof FilaEstadoBase, value: any) => {
    const nuevas = [...filas];
    const fila = { ...nuevas[index] };

    if (field === "deuda" || field === "recaudo") {
      const n = parseFloat(value);
      (fila as any)[field] = isNaN(n) ? 0 : n;
    }

    nuevas[index] = fila;
    setFilas(nuevas);
  };

  function limpiarUndefined<T extends Record<string, any>>(obj: T): T {
    return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined)) as T;
  }

  const guardarTodos = async () => {
    if (!clienteId) return;
    if (!mesGlobal) {
      toast.error("Selecciona un mes válido.");
      return;
    }

    try {
      for (const fila of filas) {
        const { deudorId, nombre, porcentajeHonorarios, deuda, recaudo } = fila;

        const honorarios = (Number(deuda) * Number(porcentajeHonorarios || 0)) / 100;

        // Estado mensual mínimo requerido por tu modelo/colección
        const estado: EstadoMensual = {
          mes: mesGlobal,
          tipo: "ordinario",           // fijo por defecto (puedes cambiarlo si lo necesitas)
          deuda: Number(deuda) || 0,
          honorarios: Number(honorarios) || 0,
          recaudo: Number(recaudo) || 0,
          comprobante: null,
          recibo: null,
          observaciones: null,
        };

        await crearEstadoMensual(clienteId, deudorId, estado);
      }

      toast.success("Todos los estados fueron guardados correctamente.");
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar algunos estados.");
    }
  };

  if (loading) return <div className="p-6">Cargando…</div>;

  return (
    <div className="p-6 space-y-6">
  {/* Encabezado */}
  <div className="flex flex-col gap-1">
    <div className="flex items-center justify-between">
      <Button variant="outline" onClick={() => navigate(-1)}>
        ← Volver
      </Button>
      <h1 className="text-2xl font-bold text-center flex-1">
        Ingreso Masivo de Estados Mensuales
      </h1>
      <div className="w-[85px]"></div> {/* espacio para balancear con el botón */}
    </div>

    <p className="text-lg text-muted-foreground text-center">
      Conjunto: <span className="font-semibold text-gray-900">{clienteNombre}</span>
    </p>
  </div>

  {/* Selector de mes */}
  <div className="flex items-center gap-3">
    <label className="font-medium">Mes:</label>
    <Input
      type="month"
      value={mesGlobal}
      onChange={(e) => setMesGlobal(e.target.value)}
      className="max-w-[200px]"
    />
  </div>

      {/* Tabla simplificada: Deudor | Deuda | Recaudo */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Deudor</th>
              <th className="p-2 text-right">Deuda</th>
              <th className="p-2 text-right">Recaudo</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila, i) => (
              <tr key={fila.deudorId} className="border-t">
                <td className="p-2">{fila.nombre}</td>
                <td className="p-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={fila.deuda}
                    onChange={(e) => handleChange(i, "deuda", e.target.value)}
                    className="text-right"
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={fila.recaudo}
                    onChange={(e) => handleChange(i, "recaudo", e.target.value)}
                    className="text-right"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button onClick={guardarTodos} className="mt-4">Guardar todos los estados</Button>
    </div>
  );
}
