// src/modules/cobranza/pages/ReporteClientePage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import {
  ResponsiveContainer, BarChart, XAxis, YAxis, CartesianGrid, Bar, LabelList, PieChart, Pie, Tooltip, Legend, Cell
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

// Tick de eje X rotado -45°
const CustomXAxisTick = (props: any) => {
  const { x, y, payload } = props;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="end"
        transform="rotate(-45)"
        style={{ fontSize: 12 }}
      >
        {payload.value}
      </text>
    </g>
  );
};

// Etiqueta arriba de cada barra con formato COP
const BarValueLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (value == null) return null;
  const cx = x + width / 2;
  const cy = y - 6; // un poco arriba de la barra
  return (
    <text x={cx} y={cy} textAnchor="middle" style={{ fontSize: 12 }}>
      {formatCOP(Number(value))}
    </text>
  );
};

// "YYYY-MM" -> "MMM YYYY"
function labelMes(m: string) {
  const [y, mm] = m.split("-");
  const date = new Date(Number(y), Number(mm) - 1, 1);
  return date.toLocaleDateString("es-CO", { month: "short", year: "numeric" });
}

// arriba del componente (o en utils)
const formatCOP = (v: number) => `$ ${v.toLocaleString("es-CO")}`;

// "YYYY-MM" -> "Mes" (enero, febrero, …)
function monthNameES(ym: string) {
  const [y, mm] = ym.split("-");
  const d = new Date(Number(y), Number(mm) - 1, 1);
  // nombre completo del mes en español
  return d.toLocaleDateString("es-CO", { month: "long" });
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
    () => barsData.map(item => ({
      mes: item.mes,                    // "YYYY-MM"
      nombreMes: monthNameES(item.mes), // "enero", "febrero", ...
      total: item.total
    })),
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
              <BarChart
                data={bars}
                margin={{ top: 10, right: 16, left: 0, bottom: 48 }}
              >
                <CartesianGrid strokeDasharray="3 3" />

                {/* Meses en diagonal (custom tick) y todos visibles */}
                <XAxis
                  dataKey="nombreMes"
                  interval={0}
                  height={56}
                  tickMargin={8}
                  tick={<CustomXAxisTick />}
                />

                <YAxis width={100} tickFormatter={formatCOP} />
                <Tooltip formatter={(v: any) => formatCOP(Number(v))} />
                <Legend />

                <Bar dataKey="total" name="Recaudo">
                  <LabelList dataKey="total" content={<BarValueLabel />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
