import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/shared/ui/popover";
import { cn } from "@/shared/lib/cn";
import { Calendar as CalendarIcon } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import type { CuotaAcuerdo } from "@/modules/cobranza/models/acuerdoPago.model";

type Props = {
  cuotas: CuotaAcuerdo[];
  readOnly?: boolean;
  onChange: (cuotas: CuotaAcuerdo[]) => void;
};

const n = (v: number) => (Number.isFinite(v) ? v : 0);

export default function TablaAmortizacionEditable({
  cuotas,
  readOnly,
  onChange,
}: Props) {
  const updateRow = (idx: number, patch: Partial<CuotaAcuerdo>) => {
    const next = cuotas.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange(next);
  };

  const handleChangeFecha = (idx: number, date?: Date) => {
    if (!date) return;
    updateRow(idx, { fechaPago: Timestamp.fromDate(date) });
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
          <TableRow className="border-brand-secondary/10">
            <TableHead>#</TableHead>
            <TableHead>Fecha de pago</TableHead>
            <TableHead>Deuda capital</TableHead>
            <TableHead>Cuota capital</TableHead>
            <TableHead>Deuda honorarios</TableHead>
            <TableHead>Cuota honorarios</TableHead>
            <TableHead>Cuota acuerdo</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {cuotas.map((c, idx) => {
            const fecha = c.fechaPago?.toDate
              ? c.fechaPago.toDate()
              : new Date();

            return (
              <TableRow
                key={c.numero}
                className={cn(
                  "border-brand-secondary/5",
                  idx % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]"
                )}
              >
                {/* 1️⃣ Nº CUOTA */}
                <TableCell className="font-medium">{c.numero}</TableCell>

                {/* 2️⃣ FECHA (CALENDAR) */}
                <TableCell className="min-w-[190px]">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={readOnly}
                        className={cn(
                          "w-full justify-start text-left font-normal border-brand-secondary/30",
                          readOnly && "opacity-70"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fecha.toLocaleDateString("es-CO")}
                      </Button>
                    </PopoverTrigger>
                    {!readOnly && (
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={fecha}
                          defaultMonth={fecha} // ✅ al abrir, se posiciona en el mes/año de la fecha seleccionada
                          onSelect={(d) => handleChangeFecha(idx, d)}
                          autoFocus // ✅ reemplaza initialFocus (evita deprecated)
                          captionLayout="dropdown"
                          startMonth={new Date(new Date().getFullYear() - 20, 0)} // ✅ pasado
                          endMonth={new Date(new Date().getFullYear() + 20, 11)}  // ✅ futuro
                        />
                      </PopoverContent>
                    )}
                  </Popover>
                </TableCell>

                {/* 3️⃣ DEUDA CAPITAL */}
                <TableCell className="text-right">
                  {n(c.capitalSaldoAntes).toLocaleString("es-CO")}
                </TableCell>

                {/* 4️⃣ CUOTA CAPITAL */}
                <TableCell className="min-w-[150px]">
                  <Input
                    type="number"
                    value={n(c.capitalCuota)}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateRow(idx, {
                        capitalCuota: Number(e.target.value),
                      })
                    }
                  />
                </TableCell>

                {/* 5️⃣ DEUDA HONORARIOS */}
                <TableCell className="text-right">
                  {n(c.honorariosSaldoAntes).toLocaleString("es-CO")}
                </TableCell>

                {/* 6️⃣ CUOTA HONORARIOS */}
                <TableCell className="min-w-[150px]">
                  <Input
                    type="number"
                    value={n(c.honorariosCuota)}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateRow(idx, {
                        honorariosCuota: Number(e.target.value),
                      })
                    }
                  />
                </TableCell>

                {/* 7️⃣ CUOTA ACUERDO */}
                <TableCell className="min-w-[160px]">
                  <Input
                    type="number"
                    value={n(c.valorCuota)}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateRow(idx, {
                        valorCuota: Number(e.target.value),
                      })
                    }
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <p className="mt-2 text-xs">
        Selecciona la fecha de cada cuota desde el calendario.
        El orden de columnas y valores financieros no se recalculan.
      </p>
    </div>
  );
}
