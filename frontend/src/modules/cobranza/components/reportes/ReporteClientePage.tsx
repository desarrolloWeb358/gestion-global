// src/modules/cobranza/pages/ReporteClientePage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ResponsiveContainer, PieChart, Pie, Tooltip, Legend, Cell,
  BarChart, XAxis, YAxis, CartesianGrid, Bar
} from "recharts";
import type { Payload as LegendPayload } from "recharts/types/component/DefaultLegendContent";

// shadcn/ui
import { Card, CardHeader, CardContent, CardTitle } from "@/shared/ui/card";
import { Separator } from "@/shared/ui/separator";
import { Loader2 } from "lucide-react";

// services
import { contarTipificacionPorCliente, PieItem } from "../../services/reportes/tipificacionService";
import { obtenerRecaudosMensuales, MesTotal } from "../../services/reportes/recaudosService";

const COLORS = ["#4F46E5", "#22C55E", "#F59E0B", "#06B6D4", "#EF4444", "#6366F1", "#10B981", "#F43F5E"];

// arriba del componente o en un utils
const formatCOP = (v: number) => `$ ${v.toLocaleString("es-CO")}`;

// "YYYY-MM" -> "MMM YYYY"
function labelMes(m: string) {
  const [y, mm] = m.split("-");
  const date = new Date(Number(y), Number(mm) - 1, 1);
  return date.toLocaleDateString("es-CO", { month: "short", year: "numeric" });
}

export default function ReporteClientePage() {
  const { clienteId } = useParams<{ clienteId: string }>();

  const [pieData, setPieData] = useState<PieItem[]>([]);
  const [barsData, setBarsData] = useState<MesTotal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clienteId) return;
    (async () => {
      setLoading(true);
      const [tip, recs] = await Promise.all([
        contarTipificacionPorCliente(clienteId),
        obtenerRecaudosMensuales(clienteId),
      ]);
      setPieData(tip);
      setBarsData(recs);
      setLoading(false);
    })();
  }, [clienteId]);

  const total = useMemo(() => pieData.reduce((acc, d) => acc + d.value, 0), [pieData]);

  const chartData = useMemo(
    () => pieData.filter(d => d.value > 0).sort((a, b) => b.value - a.value),
    [pieData]
  );

  const legendPayload: LegendPayload[] = useMemo(() => (
    pieData.map((d, i) => ({
      id: d.name,
      type: "circle" as const,
      value: `${d.name} ${total ? ((d.value / total) * 100).toFixed(0) : 0}%`,
      color: COLORS[i % COLORS.length],
    }))
  ), [pieData, total]);

  const bars = useMemo(
    () => barsData.map(item => ({ mes: labelMes(item.mes), total: item.total })),
    [barsData]
  );

  const renderLabel = (props: any) => {
    const { name, value, percent } = props;
    if (!value || percent < 0.03) return null;
    return `${name} ${(percent * 100).toFixed(0)}%`;
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando reporte…
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">Reporte de cliente</h2>
      <p className="text-sm text-muted-foreground">Tipificación y recaudo mensual total.</p>
      <Separator className="my-4" />

      {/* Tipificación ocupa toda la fila */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tipificación de inmuebles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[340px]">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={120}
                  label={renderLabel}
                  labelLine={false}
                  minAngle={3}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => `${v} inmuebles`} separator=": " />
                <Legend payload={legendPayload} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Debajo: Recaudo mensual ocupa toda la fila */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recaudo mensual (total cliente)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[340px]">
            <ResponsiveContainer>
              <BarChart data={bars} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />

                {/* <- eje Y con ancho y formato COP */}
                <YAxis
                  width={100}
                  tickFormatter={formatCOP}
                />

                {/* tooltip mostrando COP completo */}
                <Tooltip formatter={(v: any) => formatCOP(Number(v))} />
                <Legend />
                <Bar dataKey="total" name="Recaudo" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
