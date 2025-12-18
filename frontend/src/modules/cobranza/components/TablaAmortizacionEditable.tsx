import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/cn";
import type { CuotaAcuerdo } from "@/modules/cobranza/models/acuerdoPago.model";

type Props = {
  cuotas: CuotaAcuerdo[];
  readOnly?: boolean;
  onChange: (cuotas: CuotaAcuerdo[]) => void;
};

const n = (v: number) => (Number.isFinite(v) ? v : 0);

export default function TablaAmortizacionEditable({ cuotas, readOnly, onChange }: Props) {
  const updateRow = (idx: number, patch: Partial<CuotaAcuerdo>) => {
    const next = cuotas.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange(next);
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
          <TableRow className="border-brand-secondary/10">
            <TableHead className="text-brand-secondary font-semibold">#</TableHead>
            <TableHead className="text-brand-secondary font-semibold">Cuota</TableHead>
            <TableHead className="text-brand-secondary font-semibold">Capital</TableHead>
            <TableHead className="text-brand-secondary font-semibold">Honorarios</TableHead>
            <TableHead className="text-brand-secondary font-semibold">Saldo Cap.</TableHead>
            <TableHead className="text-brand-secondary font-semibold">Saldo Hon.</TableHead>            
          </TableRow>
        </TableHeader>

        <TableBody>
          {cuotas.map((c, idx) => (
            <TableRow
              key={c.numero}
              className={cn("border-brand-secondary/5", idx % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]")}
            >
              <TableCell className="font-medium">{c.numero}</TableCell>

              <TableCell className="min-w-[180px]">
                <Input
                  type="number"
                  value={n(c.valorCuota)}
                  disabled={readOnly}
                  onChange={(e) => updateRow(idx, { valorCuota: Number(e.target.value) })}
                />
              </TableCell>

              <TableCell className="min-w-[180px]">
                <Input
                  type="number"
                  value={n(c.capitalCuota)}
                  disabled={readOnly}
                  onChange={(e) => updateRow(idx, { capitalCuota: Number(e.target.value) })}
                />
              </TableCell>

              <TableCell className="min-w-[180px]">
                <Input
                  type="number"
                  value={n(c.honorariosCuota)}
                  disabled={readOnly}
                  onChange={(e) => updateRow(idx, { honorariosCuota: Number(e.target.value) })}
                />
              </TableCell>

              <TableCell className="min-w-[180px] text-sm text-muted-foreground">
                {n(c.capitalSaldoDespues).toLocaleString("es-CO")}
              </TableCell>

              <TableCell className="min-w-[180px] text-sm text-muted-foreground">
                {n(c.honorariosSaldoDespues).toLocaleString("es-CO")}
              </TableCell>              
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="mt-2 text-xs text-muted-foreground">
        Nota: al editar valores manualmente, en el guardado recalculamos saldos para que queden coherentes.
      </p>
    </div>
  );
}
