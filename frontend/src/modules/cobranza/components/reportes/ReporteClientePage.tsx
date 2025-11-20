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
import TablaDeudoresReporte from "./TablaDeudoresReporte";

import {
  contarTipificacionPorCliente,
  PieItem,
  obtenerResumenPorTipificacion,
  ResumenTipificacion,
  obtenerDetalleDeudoresPorTipificacion,
  DeudorTipificacionDetalle,
  TipificacionKey,
} from "../../services/reportes/tipificacionService";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/ui/select";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/shared/ui/table";

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


  const [resumenTip, setResumenTip] = useState<ResumenTipificacion[]>([]);

  // tipificación seleccionada en el combo
  const [tipSeleccionada, setTipSeleccionada] = useState<TipificacionKey | "">("");

  // detalle de deudores para esa tipificación
  const [detalleTip, setDetalleTip] = useState<DeudorTipificacionDetalle[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  //const total = useMemo(() => pieData.reduce((acc, d) => acc + d.value, 0), [pieData]);

  const resumenFiltrado = useMemo(
    () => resumenTip.filter((fila) => fila.inmuebles > 0),
    [resumenTip]
  );

  // pieData + color fijo por item
  const pieWithColors = useMemo(
    () =>
      pieData.map((d, i) => ({
        ...d,
        color: COLORS[i % COLORS.length],
      })),
    [pieData]
  );


  useEffect(() => {
    if (!clienteId) return;
    (async () => {
      setLoading(true);
      const [tip, recs, resumen] = await Promise.all([
        contarTipificacionPorCliente(clienteId),
        obtenerRecaudosMensuales(clienteId),
        obtenerResumenPorTipificacion(clienteId), // 👈 nuevo
      ]);
      setPieData(tip);
      setBarsData(recs);
      setResumenTip(resumen);                     // 👈 nuevo
      setLoading(false);
    })();
  }, [clienteId]);

  useEffect(() => {
    if (!clienteId || !tipSeleccionada) return;

    (async () => {
      setLoadingDetalle(true);
      const datos = await obtenerDetalleDeudoresPorTipificacion(
        clienteId,
        tipSeleccionada as TipificacionKey
      );
      setDetalleTip(datos);
      setLoadingDetalle(false);
    })();
  }, [clienteId, tipSeleccionada]);

  // Cuando cambie el resumen, escoger tipificación por defecto
  useEffect(() => {
    if (!resumenFiltrado.length) return;

    setTipSeleccionada((prev) => {
      // si la que estaba seleccionada sigue existiendo, la mantenemos
      const existe = resumenFiltrado.some(
        (fila) => fila.tipificacion === prev
      );
      return existe ? prev : resumenFiltrado[0].tipificacion;
    });
  }, [resumenFiltrado]);



  const totalesResumen = useMemo(() => {
    return resumenFiltrado.reduce(
      (acc, fila) => {
        acc.inmuebles += fila.inmuebles;
        acc.recaudoTotal += fila.recaudoTotal;
        acc.porRecuperar += fila.porRecuperar;
        return acc;
      },
      { inmuebles: 0, recaudoTotal: 0, porRecuperar: 0 }
    );
  }, [resumenFiltrado]);

  const chartData = useMemo(
    () =>
      pieWithColors
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
    [pieWithColors]
  );


  const total = useMemo(
    () => pieWithColors.reduce((acc, d) => acc + d.value, 0),
    [pieWithColors]
  );

  const legendPayload: LegendPayload[] = useMemo(
    () =>
      pieWithColors.map((d) => ({
        id: d.name,
        type: "circle" as const,
        value: `${d.name} ${total ? ((d.value / total) * 100).toFixed(0) : 0
          }%`,
        color: d.color, // 👈 mismo color que en el Pie
      })),
    [pieWithColors, total]
  );

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

      {/* Resumen por tipificación (tabla estilo Excel) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Resumen por tipificación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="w-40 font-semibold">
                    Tipificación
                  </TableHead>
                  <TableHead className="text-right font-semibold">
                    Inmuebles
                  </TableHead>
                  <TableHead className="text-right font-semibold">
                    Recaudo total
                  </TableHead>
                  <TableHead className="text-right font-semibold">
                    Por recuperar
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumenFiltrado.map((fila) => (
                  <TableRow key={fila.tipificacion}>
                    <TableCell className="font-medium">
                      {fila.tipificacion}
                    </TableCell>
                    <TableCell className="text-right">
                      {fila.inmuebles.toLocaleString("es-CO")}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCOP(fila.recaudoTotal)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCOP(fila.porRecuperar)}
                    </TableCell>
                  </TableRow>
                ))}

                {/* fila total */}
                <TableRow className="font-semibold bg-muted/40">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">
                    {totalesResumen.inmuebles.toLocaleString("es-CO")}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCOP(totalesResumen.recaudoTotal)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCOP(totalesResumen.porRecuperar)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
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

      {/* Detalle de deudores por tipificación */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Detalle de deudores por tipificación
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {resumenFiltrado.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay deudores con tipificación registrada.
            </p>
          ) : (
            <>
              {/* Selector de tipificación */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  Tipificación:
                </span>
                <Select
                  value={tipSeleccionada}
                  onValueChange={(value) =>
                    setTipSeleccionada(value as TipificacionKey)
                  }
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Selecciona una tipificación" />
                  </SelectTrigger>
                  <SelectContent>
                    {resumenFiltrado.map((fila) => (
                      <SelectItem
                        key={fila.tipificacion}
                        value={fila.tipificacion}
                      >
                        {fila.tipificacion} ({fila.inmuebles})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Título dinámico */}
              {tipSeleccionada && (
                <h4 className="font-semibold text-sm">
                  Deudores en tipificación: {tipSeleccionada}
                </h4>
              )}

              {/* Tabla o loader */}
              {loadingDetalle ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando deudores…
                </div>
              ) : detalleTip.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay deudores para esta tipificación.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/60">
                        <TableHead className="w-24 font-semibold">
                          Ubicación
                        </TableHead>
                        <TableHead className="font-semibold">
                          Deudor
                        </TableHead>
                        <TableHead className="text-right font-semibold">
                          Recaudo total
                        </TableHead>
                        <TableHead className="text-right font-semibold">
                          Por recuperar
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalleTip.map((fila) => (
                        <TableRow key={fila.deudorId}>
                          <TableCell>{fila.ubicacion}</TableCell>
                          <TableCell>{fila.nombre}</TableCell>
                          <TableCell className="text-right">
                            {formatCOP(fila.recaudoTotal)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCOP(fila.porRecuperar)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>


      {/* Sección de tabla de deudores */}
      {clienteId && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Tabla de deudores (año)</h3>
          <TablaDeudoresReporte clienteId={clienteId} />
        </div>
      )}
    </div>
  );
}
