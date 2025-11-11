"use client";

import * as React from "react";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";

import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";

import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";

// 🔹 Eliminamos los imports relacionados con clientes
// import {
//   listarClientesBasico,
//   ClienteOption,
// } from "@/modules/clientes/services/clienteService";

import {
  obtenerSeguimientosRango,
  agruparPorEjecutivo,
} from "../services/seguimientoReporteService";
import { ResumenEjecutivo } from "../models/seguimientoReporte.model";
import { obtenerUsuarios } from "@/modules/usuarios/services/usuarioService";

// Recharts
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

// =======================
// Helpers de fecha
// =======================
function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export default function SeguimientoDashboardAdmin() {
  const { can, loading: aclLoading } = useAcl();
  const canView =
    can(PERMS.Admin_Read) ||
    can(PERMS.Seguimientos_Read);

  // ============================
  // Filtros (solo fechas)
  // ============================
  const [dateFrom, setDateFrom] = React.useState<Date>(today());
  const [dateTo, setDateTo] = React.useState<Date>(today());

  // ============================
  // Datos
  // ============================
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<ResumenEjecutivo[]>([]);

  // Mapa uid -> nombre ejecutivo
  const [usuariosMap, setUsuariosMap] =
    React.useState<Record<string, string>>({});

  // 🔹 Comentamos toda la lógica de clientes
  // const [clientes, setClientes] = React.useState<ClienteOption[]>([]);
  // const [clienteFilter, setClienteFilter] = React.useState<string>("__ALL__");

  // ============================
  // Cargar usuarios para mostrar nombres
  // ============================
  React.useEffect(() => {
    if (!canView) return;
    (async () => {
      try {
        const usuarios = await obtenerUsuarios();
        const map: Record<string, string> = {};
        for (const u of usuarios) {
          if (!u.uid) continue;
          map[u.uid] =
            (u.nombre && u.nombre.trim()) || u.email || u.uid;
        }
        setUsuariosMap(map);
      } catch (err) {
        console.error(
          "Error cargando usuarios para nombres de ejecutivos:",
          err
        );
      }
    })();
  }, [canView]);

  // ============================
  // Fetch único: fechas (sin cliente)
  // ============================
  const fetchData = React.useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const desde = dateFrom;
      const hasta = dateTo || endOfDay(dateFrom);

      // 🔹 Eliminamos el filtro de cliente aquí
      // const clienteUid =
      //   clienteFilter === "__ALL__" ? undefined : clienteFilter;

      const items = await obtenerSeguimientosRango(desde, hasta /* , clienteUid */);
      const resumen = agruparPorEjecutivo(items);
      setData(resumen);
    } catch (err) {
      console.error("Error obteniendo resumen de seguimientos:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [canView, dateFrom, dateTo /* , clienteFilter */]);

  // Ejecutar cuando cambien las fechas
  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================
  // Render gráfico
  // ============================
  const renderBarChart = (rows: ResumenEjecutivo[]) => {
    if (!rows || rows.length === 0) {
      return (
        <p className="text-sm text-muted-foreground py-4">
          No hay seguimientos para los filtros seleccionados.
        </p>
      );
    }

    const dataChart = rows.map((r) => {
      const label =
        usuariosMap[r.ejecutivoUID] ||
        r.ejecutivoUID ||
        "SIN_EJECUTIVO";
      return {
        ejecutivoUid: r.ejecutivoUID,
        label,
        total: r.total,
        prejuridico: r.prejuridico,
        juridico: r.juridico,
        demanda: r.demanda,
      };
    });

    return (
      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={dataChart}
            margin={{ left: 8, right: 8, top: 16 }}
          >
            <XAxis dataKey="label" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="total"
              fill="currentColor"
              className="text-sky-600"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // ============================
  // Render principal
  // ============================
  if (aclLoading) {
    return <p className="p-4 text-sm">Cargando permisos…</p>;
  }
  if (!canView) {
    return (
      <p className="p-4 text-sm">
        No tienes permisos para ver el dashboard de seguimientos.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros superiores */}
      <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-5 items-end">
        {/* Desde */}
        <div className="flex flex-col gap-1">
          <Label>Desde</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom
                  ? dateFrom.toLocaleDateString("es-CO")
                  : "Selecciona fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={(d) => d && setDateFrom(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Hasta */}
        <div className="flex flex-col gap-1">
          <Label>Hasta</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo
                  ? dateTo.toLocaleDateString("es-CO")
                  : "Misma fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={(d) => setDateTo(d || dateFrom)}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* 🔹 Comentamos el selector de cliente */}
        {/* <div className="flex flex-col gap-1">
          <Label>Cliente</Label>
          <Select
            value={clienteFilter}
            onValueChange={(v) => setClienteFilter(v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos / Ninguno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">Todos / Ninguno</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div> */}

        {/* Botones rápidos */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="mt-6 w-full"
            onClick={() => {
              const t = today();
              setDateFrom(t);
              setDateTo(t);
              // setClienteFilter("__ALL__");
            }}
          >
            Hoy
          </Button>
          
        </div>

        <div className="mt-6 flex items-center">
          {loading && (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculando…
            </span>
          )}
        </div>
      </div>

      {/* Gráfico único */}
      <section className="space-y-3 border rounded-xl p-4 bg-muted/40">
        <h3 className="text-base font-semibold">
          Seguimientos por ejecutivo (todas las carteras)
        </h3>
        {renderBarChart(data)}
      </section>
    </div>
  );
}
