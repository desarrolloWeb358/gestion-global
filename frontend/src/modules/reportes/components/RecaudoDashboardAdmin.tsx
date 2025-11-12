"use client";

import * as React from "react";
import { Loader2, Calendar as CalendarIcon, PieChart as PieIcon } from "lucide-react";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Card } from "@/shared/ui/card";
import { ResumenMesSeleccionado } from "../models/recaudoMensual.model";
import { obtenerResumenMesConNombres } from "../services/recaudoMensualService";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

// helpers
const currency = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const monthLabels = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

function currentYearMonth(): { year: string; month: string } {
  const d = new Date();
  return { year: String(d.getFullYear()), month: String(d.getMonth() + 1).padStart(2, "0") };
}

export default function RecaudoDashboardAdmin() {
  const { can, loading: aclLoading } = useAcl();
  const canView = can(PERMS.Admin_Read) || can(PERMS.Valores_Read);

  const { year: y, month: m } = currentYearMonth();
  const [year, setYear] = React.useState<string>(y);
  const [month, setMonth] = React.useState<string>(m);

  const [loading, setLoading] = React.useState(false);
  const [resumen, setResumen] = React.useState<ResumenMesSeleccionado | null>(null);

  const years = React.useMemo(() => {
    const max = new Date().getFullYear();
    const arr: string[] = [];
    for (let a = 2000; a <= max; a++) arr.push(String(a));
    return arr.reverse();
  }, []);

  const mesClave = `${year}-${month}`;

  const fetchData = React.useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const res = await obtenerResumenMesConNombres(mesClave);
      setResumen(res);
    } catch (err) {
      console.error("Error obteniendo estados mensuales:", err);
      setResumen(null);
    } finally {
      setLoading(false);
    }
  }, [canView, mesClave]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Datos para gráfica por cliente (top 10)
  const chartData = React.useMemo(() => {
    if (!resumen) return [];
    return resumen.porCliente.slice(0, 10).map((r) => ({
      cliente: r.clienteNombre,   // ← nombre visible
      Recaudado: r.recaudo,
      Deuda: r.deuda,
      Honorarios: r.honorario,
    }));
  }, [resumen]);

  if (aclLoading) return <p className="p-4 text-sm">Cargando permisos…</p>;
  if (!canView) return <p className="p-4 text-sm">No tienes acceso al reporte.</p>;

  return (
    <div className="space-y-6">
      {/* FILTROS: Año + Mes */}
      <div className="grid gap-3 md:grid-cols-5 items-end">
        <div className="flex flex-col gap-1">
          <Label>Año</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger><SelectValue placeholder="Año" /></SelectTrigger>
            <SelectContent>
              {years.map((yy) => <SelectItem key={yy} value={yy}>{yy}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label>Mes</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger><SelectValue placeholder="Mes" /></SelectTrigger>
            <SelectContent>
              {monthLabels.map((mm) => (
                <SelectItem key={mm.value} value={mm.value}>{mm.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="mt-6" onClick={fetchData}>
            <CalendarIcon className="mr-2 h-4 w-4" /> Consultar {mesClave}
          </Button>
          {loading && (
            <span className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </span>
          )}
        </div>
      </div>

      {/* KPIs (sin % recuperado) */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Total Recaudado ({mesClave})</div>
          <div className="text-2xl font-semibold">
            {currency(resumen?.totales.totalRecaudo ?? 0)}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Deuda Total ({mesClave})</div>
          <div className="text-2xl font-semibold">
            {currency(resumen?.totales.totalDeuda ?? 0)}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Honorarios ({mesClave})</div>
          <div className="text-2xl font-semibold">
            {currency(resumen?.totales.totalHonorario ?? 0)}
          </div>
        </Card>
      </div>

      {/* GRÁFICO: Top 10 clientes del mes (con nombre) */}
      <section className="space-y-3 border rounded-xl p-4 bg-muted/40">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <PieIcon className="h-4 w-4" /> Recaudo por cliente (top 10) – {mesClave}
        </h3>

        {(!chartData || chartData.length === 0) ? (
          <p className="text-sm text-muted-foreground py-4">No hay registros para {mesClave}.</p>
        ) : (
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: 8, right: 8, top: 16 }}>
                <XAxis dataKey="cliente" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Recaudado" fill="#22c55e" />
                <Bar dataKey="Deuda" fill="#f59e0b" />
                <Bar dataKey="Honorarios" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* TABLA (sin % recuperado) */}
      <section className="border rounded-xl p-4">
        <h4 className="font-semibold mb-3">Detalle por cliente – {mesClave}</h4>
        {!resumen?.porCliente?.length ? (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4">Deuda</th>
                  <th className="py-2 pr-4">Recaudo</th>
                  <th className="py-2 pr-0">Honorarios</th>
                </tr>
              </thead>
              <tbody>
                {resumen.porCliente.map((r) => (
                  <tr key={r.clienteUID} className="border-t">
                    <td className="py-2 pr-4">{r.clienteNombre}</td>
                    <td className="py-2 pr-4">{currency(r.deuda)}</td>
                    <td className="py-2 pr-4">{currency(r.recaudo)}</td>
                    <td className="py-2 pr-0">{currency(r.honorario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
