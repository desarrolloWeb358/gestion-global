import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import type { Payload as LegendPayload } from "recharts/types/component/DefaultLegendContent"; // 👈 tipo correcto
import { contarTipificacionPorCliente, PieItem } from "../../services/reportes/reportesService";
import { Box } from "@mui/material";

const COLORS = ["#4F46E5", "#22C55E", "#F59E0B", "#06B6D4", "#EF4444", "#6366F1"];

export default function TipificacionPorInmueblePage() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const [data, setData] = useState<PieItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clienteId) return;
    (async () => {
      setLoading(true);
      const res = await contarTipificacionPorCliente(clienteId);
      setData(res);
      setLoading(false);
    })();
  }, [clienteId]);

  const total = data.reduce((acc, d) => acc + d.value, 0);

  // 1) Solo dibujo sectores con valor > 0
  const chartData = data
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  // 2) Etiqueta segura (evita 0% y muy pequeñas)
  const renderLabel = (props: any) => {
    const { name, value, percent } = props;
    if (!value || percent < 0.03) return null; // <3%
    return `${name} ${(percent * 100).toFixed(0)}%`;
  };

  // 3) Leyenda que muestra TODAS las categorías (incluidas las de 0)
  const legendPayload: LegendPayload[] = data.map((d, i) => ({
    id: d.name,
    type: "circle" as const, // 👈 literal, no string
    value: `${d.name} ${total ? ((d.value / total) * 100).toFixed(0) : 0}%`,
    color: COLORS[i % COLORS.length],
  }));

  if (loading) return <Box p={2}>Cargando...</Box>;

  return (
    <Box height={380}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            outerRadius={140}            
            label={renderLabel}
            labelLine={false}
            minAngle={3}               // evita “rebanadas” de 1px si algo muy chico queda
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>

          <Tooltip formatter={(v: any) => `${v} inmuebles`} separator=": " />
          <Legend payload={legendPayload} />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
}
