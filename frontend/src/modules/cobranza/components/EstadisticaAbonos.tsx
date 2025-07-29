"use client"

import { useState } from "react"
import {
  AreaChart,
  Area,
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

  const rawData = Object.entries(deudor.abonos || {})
    .map(([mes, info]) => ({
      date: info.fecha, // usar la fecha del recaudo
      recaudo: info.monto,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

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
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillRecaudo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-recaudo)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-recaudo)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString("es-CO", {
                  month: "short",
                  day: "numeric",
                })
              }
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString("es-CO", {
                      month: "short",
                      day: "numeric",
                    })
                  }
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="recaudo"
              type="natural"
              fill="url(#fillRecaudo)"
              stroke="var(--color-recaudo)"
              name="Monto recaudo"
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
