import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Deudor } from "../models/deudores.model";
import { EstadoMensual } from "../models/estadoMensual.model";
import { obtenerDeudorPorCliente, crearEstadoMensual } from "../services/deudorService";


interface FilaEstado extends EstadoMensual {
    deudorId: string;
    nombre: string;
    porcentajeHonorarios: number;

}

export default function EstadosMensualesInputMasivo() {
    const { clienteId } = useParams();
    const navigate = useNavigate();
    const [filas, setFilas] = useState<FilaEstado[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!clienteId) return;

        obtenerDeudorPorCliente(clienteId).then((deudores: Deudor[]) => {
            const mesActual = new Date().toISOString().slice(0, 7);
            const nuevasFilas = deudores.map((d) => {
                const deuda = 0;
                const porcentaje = d.porcentajeHonorarios || 0;
                const honorarios = (deuda * porcentaje) / 100;

                return {
                    deudorId: d.id!,
                    nombre: d.nombre || "Sin nombre",
                    mes: mesActual,
                    tipo: "ordinario" as const,
                    deuda: 0,
                    porcentajeHonorarios: d.porcentajeHonorarios || 0,
                    honorarios: 0,
                    recaudo: 0,
                    comprobante: null,      // ✅ ahora válido
                    recibo: "",
                    observaciones: "",
                };
            });

            setFilas(nuevasFilas);
            setLoading(false);
        });
    }, [clienteId]);

    const handleChange = (index: number, field: keyof FilaEstado, value: any) => {
        const nuevasFilas = [...filas];
        const fila = { ...nuevasFilas[index] };

        if (field === "deuda" || field === "honorarios" || field === "recaudo") {
            const n = parseFloat(value);
            (fila as any)[field] = isNaN(n) ? 0 : n;

            if (field === "deuda") {
                const porcentaje = fila.porcentajeHonorarios ?? 0;
                fila.honorarios = isNaN(n) ? 0 : (n * porcentaje) / 100;
            }
        } else if (field === "tipo" || field === "mes" || field === "recibo" || field === "observaciones") {
            (fila as any)[field] = value;
        } else if (field === "comprobante") {
            // Si algún día lo editas: nunca undefined
            (fila as any)[field] = value ?? null;
        }

        nuevasFilas[index] = fila;
        setFilas(nuevasFilas);
    };

    function limpiarUndefined<T extends Record<string, any>>(obj: T): T {
        const limpio = Object.fromEntries(
            Object.entries(obj).filter(([_, v]) => v !== undefined)
        ) as T;
        // Si tienes campos opcionales conocidos, puedes convertir "" a null si quieres:
        if ('comprobante' in limpio && limpio.comprobante === undefined) (limpio as any).comprobante = null;
        if ('recibo' in limpio && limpio.recibo === undefined) (limpio as any).recibo = null;
        if ('observaciones' in limpio && limpio.observaciones === undefined) (limpio as any).observaciones = null;
        return limpio;
    }

    const guardarTodos = async () => {
        if (!clienteId) return;

        try {
            for (const fila of filas) {
                const { deudorId, nombre, porcentajeHonorarios, ...estado } = fila;

                // Normaliza por si acaso:
                const estadoLimpio = limpiarUndefined({
                    ...estado,
                    comprobante: estado.comprobante ?? null, // ✅ asegúralo aquí también
                    recibo: estado.recibo ?? null,
                    observaciones: estado.observaciones ?? null,
                });

                await crearEstadoMensual(clienteId, deudorId, estadoLimpio);
            }

            toast.success("Todos los estados fueron guardados correctamente.");
        } catch (err) {
            console.error(err);
            toast.error("Error al guardar algunos estados.");
        }
    };
    return (
        <div className="p-6 space-y-6">
            <Button variant="outline" onClick={() => navigate(-1)}>
                ← Volver
            </Button>
            <h2 className="text-2xl font-bold">Ingreso Masivo de Estados Mensuales</h2>

            <div className="overflow-x-auto">
                <table className="w-full text-sm border">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-2 text-left">Deudor</th>
                            <th className="p-2">Mes</th>
                            <th className="p-2">Tipo</th>
                            <th className="p-2">Deuda</th>
                            <th className="p-2">Honorarios</th>
                            <th className="p-2">Recaudo</th>
                            <th className="p-2">Recibo</th>
                            <th className="p-2">Observaciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filas.map((fila, i) => (
                            <tr key={i} className="border-t">
                                <td className="p-2">{fila.nombre}</td>
                                <td className="p-2">
                                    <Input
                                        type="month"
                                        value={fila.mes}
                                        onChange={(e) => handleChange(i, "mes", e.target.value)}
                                    />
                                </td>
                                <td className="p-2">
                                    <Select
                                        value={fila.tipo}
                                        onValueChange={(val) => handleChange(i, "tipo", val as any)}
                                    >
                                        <SelectTrigger className="w-[120px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ordinario">Ordinario</SelectItem>
                                            <SelectItem value="extraordinario">Extraordinario</SelectItem>
                                            <SelectItem value="anticipo">Anticipo</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </td>
                                <td className="p-2">
                                    <Input
                                        type="number"
                                        value={fila.deuda}
                                        onChange={(e) => handleChange(i, "deuda", e.target.value)}
                                    />
                                </td>
                                <td className="p-2 text-right">
                                    <Input
                                        type="number"
                                        value={fila.honorarios}
                                        onChange={(e) => handleChange(i, "honorarios", e.target.value)}
                                    />
                                </td>
                                <td className="p-2">
                                    <Input
                                        type="number"
                                        value={fila.recaudo}
                                        onChange={(e) => handleChange(i, "recaudo", e.target.value)}
                                    />
                                </td>
                                <td className="p-2">
                                    <Input
                                        value={fila.recibo ?? ""}
                                        onChange={(e) => handleChange(i, "recibo", e.target.value)}
                                    />
                                </td>
                                <td className="p-2">
                                    <Input
                                        value={fila.observaciones ?? ""}
                                        onChange={(e) => handleChange(i, "observaciones", e.target.value)}
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
