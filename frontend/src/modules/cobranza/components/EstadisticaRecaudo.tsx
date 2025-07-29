// src/modules/deudores/components/EstadisticaAbonos.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Deudor } from "../models/deudores.model";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function EstadisticaAbonos({ deudor }: { deudor: Deudor }) {
  const abonos = Array.isArray(deudor.abonos) ? deudor.abonos : [];

  // Ordenamos por fecha
  const data = [...abonos].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()).map((abono) => ({
    fecha: new Date(abono.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' }),
    monto: abono.monto,
  }));

  const totalAbonos = abonos.reduce((acc, a) => acc + a.monto, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estadística de Abonos</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay abonos registrados.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <XAxis dataKey="fecha" stroke="#8884d8" />
                <YAxis stroke="#8884d8" />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="monto"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.3}
                  name="Monto abono"
                />
              </AreaChart>
            </ResponsiveContainer>

            <p className="text-sm mt-4">
              <strong>Total abonado:</strong> ${totalAbonos.toLocaleString()}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
