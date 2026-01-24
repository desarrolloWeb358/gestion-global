// src/modules/cobranza/services/reportes/exportExcel.ts
import * as XLSX from "xlsx";
import type { FilaReporte } from "./tipos";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// helper para mapear rec_01..rec_12
function getRec(r: FilaReporte, idx1based: number): number {
  const key = `rec_${String(idx1based).padStart(2, "0")}` as keyof FilaReporte;
  return Number(r[key] ?? 0);
}

/**
 * Exporta Excel con corte hasta el mes consultado.
 * month: 1..12
 */
export function exportarExcel(
  rows: FilaReporte[],
  year: number,
  month: number,
  nombreArchivo = `Reporte_${year}_${String(month).padStart(2, "0")}.xlsx`
) {
  const m = Math.max(1, Math.min(12, Number(month) || 1));
  const mesesVisibles = MESES.slice(0, m);

  // Header dinámico
  const header = [
    "Tipificación",
    "Inmueble",
    "Nombre",
    "Por Recaudar",
    ...mesesVisibles,
    "Recaudo Total",
  ];

  const data = rows.map((r) => ([
    r.tipificacion,
    r.inmueble,
    r.nombre,
    Number(r.porRecaudar ?? 0),
    ...Array.from({ length: m }).map((_, i) => getRec(r, i + 1)),
    Number(r.recaudoTotal ?? 0),
  ]));

  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);

  // Formato de dinero:
  // Columnas: 0 Tip, 1 Inm, 2 Nombre, 3 PorRecaudar, 4..(3+m) Meses, (4+m) Total
  const colPorRecaudar = 3;
  const colMesInicio = 4;
  const colMesFin = 3 + m;      // última columna de mes
  const colTotal = 4 + m;       // recaudo total

  const moneyCols: number[] = [colPorRecaudar];
  for (let c = colMesInicio; c <= colMesFin; c++) moneyCols.push(c);
  moneyCols.push(colTotal);

  const ref = ws["!ref"] as string | undefined;
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    for (let R = 1; R <= range.e.r; R++) {
      for (const C of moneyCols) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell && typeof cell.v === "number") {
          cell.z = '#,##0'; // separador miles (Excel se adapta al locale)
        }
      }
    }
  }

  // Anchos de columnas (dinámico)
  ws["!cols"] = [
    { wch: 18 }, // Tipificación
    { wch: 12 }, // Inmueble
    { wch: 30 }, // Nombre
    { wch: 14 }, // Por Recaudar
    ...Array(m).fill({ wch: 14 }), // meses visibles
    { wch: 14 }, // Recaudo Total
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Reporte ${year}-${String(m).padStart(2, "0")}`);
  XLSX.writeFile(wb, nombreArchivo);
}
