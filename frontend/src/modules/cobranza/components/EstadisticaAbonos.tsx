"use client"

import { useState } from "react"
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from "@/components/ui/card"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Deudor } from "../models/deudores.model"

export default function EstadisticaAbonos({ deudor }: { deudor: Deudor }) {
  const [timeRange, setTimeRange] = useState("90d")

  const chartConfig = {
    recaudo: {
      label: "Recaudo mensual",
      color: "var(--chart-1)",
    },
  }

  const rawData = Object.entries(deudor.abonos || {}).map(([mes, info]) => {
    const abonoInfo = info as unknown as { fecha: string; monto: number }
    return {
      date: abonoInfo.fecha,
      monto: abonoInfo.monto,
    }
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const filteredData = rawData.filter((item) => {
    const date = new Date(item.date)
    const referenceDate = new Date()
    let daysToSubtract = 90
    if (timeRange === "30d") daysToSubtract = 30
    if (timeRange === "7d") daysToSubtract = 7
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return date >= startDate
  })

  const formattedData = filteredData.map((item) => ({
    date: new Date(item.date).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short"
    }),
    monto: item.monto,
  }))

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>Estadística de recaudos</CardTitle>
          <CardDescription>Pagos registrados por mes</CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="hidden w-[160px] sm:flex">
            <SelectValue placeholder="Últimos 3 meses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="90d">Últimos 3 meses</SelectItem>
            <SelectItem value="30d">Últimos 30 días</SelectItem>
            <SelectItem value="7d">Últimos 7 días</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <BarChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dashed"
                  labelFormatter={(value) => `Fecha: ${value}`}
                />
              }
            />
            <Bar
              dataKey="monto"
              name="Monto"
              fill="var(--color-recaudo)"
              radius={[4, 4, 0, 0]}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
