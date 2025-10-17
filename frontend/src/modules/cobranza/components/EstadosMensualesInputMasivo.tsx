import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { toast } from "sonner";
import { Deudor } from "../models/deudores.model";
import { obtenerDeudorPorCliente } from "../services/deudorService";
import { upsertEstadoMensualPorMes } from "../services/estadoMensualService"; // 👈 usa upsert (no crear)
import { db } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";

interface FilaEstadoBase {
  deudorId: string;
  nombre: string;
  porcentajeHonorarios: string;
  deuda: string;    // 👈 strings para inputs controlados
  recaudo: string;  // 👈 strings para inputs controlados
  acuerdo?: string;
}

export default function EstadosMensualesInputMasivo() {
  const { clienteId } = useParams();
  const navigate = useNavigate();

  const [clienteNombre, setClienteNombre] = useState<string>("");
  const [mesGlobal, setMesGlobal] = useState<string>(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [filas, setFilas] = useState<FilaEstadoBase[]>([]);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  // Cargar nombre del cliente
  useEffect(() => {
    if (!clienteId) return;
    (async () => {
      try {
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
        porcentajeHonorarios: "15",
        deuda: "",    // 👈 string vacío: controlled
        recaudo: "",  // 👈 string vacío: controlled
        acuerdo: "",
      }));
      setFilas(nuevasFilas);
      setLoading(false);
    });
  }, [clienteId]);

  const handleChange = (index: number, field: keyof FilaEstadoBase, value: string) => {
    setFilas((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const toNumOrUndefined = (v: string) => (v === "" ? undefined : Number(v));

  const filaCompleta = (f: FilaEstadoBase) =>
    f.deuda.trim() !== "" && f.recaudo.trim() !== "";



  const guardarTodos = async () => {
    if (!clienteId) return;
    if (!mesGlobal) {
      toast.error("Selecciona un mes válido.");
      return;
    }

    const porGuardar = filas.filter((f) => f.deuda.trim() !== "" && f.recaudo.trim() !== "");
    const omitidas = filas.length - porGuardar.length;

    if (porGuardar.length === 0) {
      toast.error("No hay filas completas (deuda y recaudo) para guardar.");
      return;
    }

    try {
      setSaving(true);                       // 🔒 bloquear y mostrar overlay
      await Promise.all(
        porGuardar.map(async (fila) => {
          const deudaNum = Number(fila.deuda);
          const recaudoNum = Number(fila.recaudo);
          const acuerdoNum = Number(fila.acuerdo);
          const porcentaje = Number(fila.porcentajeHonorarios || "15");
          const honorariosDeuda = (deudaNum * porcentaje) / 100;
          const honorariosAcuerdo = (acuerdoNum * porcentaje) / 100;

          await upsertEstadoMensualPorMes(clienteId, fila.deudorId, {
            mes: mesGlobal,
            deuda: deudaNum,
            recaudo: recaudoNum,
            acuerdo: acuerdoNum,
            porcentajeHonorarios: porcentaje,
            honorariosDeuda,
            honorariosAcuerdo,
            recibo: "",
            observaciones: "",
          });
        })
      );

      toast.success(
        `Se guardaron ${porGuardar.length} fila(s).` +
        (omitidas > 0 ? ` Omitidas ${omitidas} sin deuda y/o recaudo.` : "")
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Error al guardar algunos estados.");
    } finally {
      setSaving(false);                      // 🔓 quitar bloqueo
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
          <div className="w-[85px]" />
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
          value={mesGlobal ?? ""}
          onChange={(e) => setMesGlobal(e.target.value.slice(0, 7))}
          className="max-w-[200px]"
        />
      </div>


      <div className="relative">
        {/* Deshabilita todo mientras guarda */}
        <fieldset disabled={saving} className="space-y-4">
          {/* Tabla: Deudor | Deuda | Recaudo */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Deudor</th>
                  <th className="p-2 text-right">Deuda</th>
                  <th className="p-2 text-right">Recaudo</th>
                  <th className="p-2 text-right">Acuerdo</th>
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
                        value={fila.deuda ?? ""}
                        onChange={(e) => handleChange(i, "deuda", e.target.value)}
                        className="text-right"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={fila.recaudo ?? ""}
                        onChange={(e) => handleChange(i, "recaudo", e.target.value)}
                        className="text-right"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={fila.acuerdo ?? ""}
                        onChange={(e) => handleChange(i, "acuerdo", e.target.value)}
                        className="text-right"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button onClick={guardarTodos} className="mt-4" disabled={saving}>
            {saving ? "Guardando…" : "Guardar todos los estados"}
          </Button>
        </fieldset>

        {/* Overlay centrado mientras saving */}
        {saving && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm rounded-md">
            <span className="text-sm font-medium">Guardando…</span>
          </div>
        )}
      </div>
    </div>
  );
}
