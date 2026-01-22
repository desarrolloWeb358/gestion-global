import React, { useEffect, useState } from "react";
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
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/ui/popover";
import { cn } from "@/shared/lib/cn";
import { Calendar as CalendarIcon } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import type { CuotaAcuerdo } from "@/modules/cobranza/models/acuerdoPago.model";

type Props = {
  cuotas: CuotaAcuerdo[];
  readOnly?: boolean;
  onChange: (cuotas: CuotaAcuerdo[], meta?: { changedIndex?: number }) => void;
};

const toInt = (s: string) => {
  // deja solo dígitos
  const clean = s.replace(/[^\d]/g, "");
  return clean ? Math.round(Number(clean)) : NaN;
};

export default function TablaAmortizacionEditable({
  cuotas,
  readOnly,
  onChange,
}: Props) {
  // 👇 draft por índice (string), para permitir borrar/editar sin recalcular
  const [draftCuota, setDraftCuota] = useState<Record<number, string>>({});

  // 👇 para no pisar el valor mientras el usuario está editando esa celda
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  // ✅ Mantener draft en sync cuando cambie la tabla (por recálculos externos, cargar, etc.)
  //    PERO sin pisar la celda que se está editando
  useEffect(() => {
    setDraftCuota((prev) => {
      const next: Record<number, string> = { ...prev };

      cuotas.forEach((c, idx) => {
        if (editingIdx === idx) return; // 👈 no pisar si está editando
        next[idx] = String(c.valorCuota ?? "");
      });

      // limpia drafts de índices que ya no existan
      Object.keys(next).forEach((k) => {
        const i = Number(k);
        if (i >= cuotas.length) delete next[i];
      });

      return next;
    });
  }, [cuotas, editingIdx]);

  const updateRow = (idx: number, patch: Partial<CuotaAcuerdo>) => {
    const next = cuotas.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange(next, { changedIndex: idx });
  };

  const handleChangeFecha = (idx: number, date?: Date) => {
    if (!date) return;
    updateRow(idx, { fechaPago: Timestamp.fromDate(date) });
  };

  const commitValorCuota = (idx: number) => {
    const raw = draftCuota[idx] ?? "";
    const parsed = toInt(raw);

    // si quedó vacío o inválido, NO recalcules; revierte al valor anterior
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setDraftCuota((p) => ({
        ...p,
        [idx]: String(cuotas[idx]?.valorCuota ?? ""),
      }));
      return;
    }

    // si no cambió, no hagas nada
    const current = Math.round(Number(cuotas[idx]?.valorCuota ?? 0));
    if (parsed === current) return;

    updateRow(idx, { valorCuota: parsed });
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
            const fecha = c.fechaPago?.toDate ? c.fechaPago.toDate() : new Date();

            return (
              <TableRow
                key={idx} // ✅ key estable por posición para evitar “reuso” raro cuando renumeras
                className={cn(
                  "border-brand-secondary/5",
                  idx % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]"
                )}
              >
                <TableCell className="font-medium">{c.numero}</TableCell>

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
                          defaultMonth={fecha}
                          onSelect={(d) => handleChangeFecha(idx, d)}
                          autoFocus
                          captionLayout="dropdown"
                          startMonth={new Date(new Date().getFullYear() - 20, 0)}
                          endMonth={new Date(new Date().getFullYear() + 20, 11)}
                        />
                      </PopoverContent>
                    )}
                  </Popover>
                </TableCell>

                <TableCell className="text-right">
                  {Math.round(c.capitalSaldoAntes || 0).toLocaleString("es-CO")}
                </TableCell>

                <TableCell className="text-right min-w-[150px]">
                  {Math.round(c.capitalCuota || 0).toLocaleString("es-CO")}
                </TableCell>

                <TableCell className="text-right">
                  {Math.round(c.honorariosSaldoAntes || 0).toLocaleString("es-CO")}
                </TableCell>

                <TableCell className="text-right min-w-[150px]">
                  {Math.round(c.honorariosCuota || 0).toLocaleString("es-CO")}
                </TableCell>

                {/* 👇 EDITABLE: string + commit en blur/enter */}
                <TableCell className="min-w-[160px]">
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    disabled={readOnly}
                    value={draftCuota[idx] ?? String(c.valorCuota ?? "")}
                    onChange={(e) =>
                      setDraftCuota((p) => ({ ...p, [idx]: e.target.value }))
                    }
                    onFocus={(e) => {
                      setEditingIdx(idx);
                      e.currentTarget.select();
                    }}
                    onBlur={() => {
                      commitValorCuota(idx);
                      setEditingIdx(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.currentTarget as HTMLInputElement).blur();
                      }
                      if (e.key === "Escape") {
                        // revertir
                        setDraftCuota((p) => ({
                          ...p,
                          [idx]: String(cuotas[idx]?.valorCuota ?? ""),
                        }));
                        (e.currentTarget as HTMLInputElement).blur();
                      }
                    }}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <p className="mt-2 text-xs">
        Selecciona la fecha de cada cuota desde el calendario. El recálculo de
        valores se aplica al salir del campo (o Enter).
      </p>
    </div>
  );
}
