// src/modules/cobranza/services/reportes/exportExcel.ts
import * as XLSX from "xlsx";
import type { FilaReporte } from "./tipos";

export function exportarExcel(rows: FilaReporte[], year: number, nombreArchivo = `Reporte_${year}.xlsx`) {
  const header = [
    "Tipificación","Inmueble","Nombre","Capital Ene",
    "Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic",
    "Recaudo Total"
  ];

  const data = rows.map(r => ([
    r.tipificacion, r.inmueble, r.nombre, r.porRecaudar,
    r.rec_01, r.rec_02, r.rec_03, r.rec_04, r.rec_05, r.rec_06,
    r.rec_07, r.rec_08, r.rec_09, r.rec_10, r.rec_11, r.rec_12,
    r.recaudoTotal,
  ]));

  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);

  // formatear columnas de dinero:
  const moneyCols = [3,4,5,6,7,8,9,10,11,12,13,14,15,16]; // 0-index (Capital Ene y meses)
  const range = XLSX.utils.decode_range(ws["!ref"] as string);
  for (let R = 1; R <= range.e.r; R++) {
    for (const C of moneyCols) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && typeof cell.v === "number") cell.z = '#,##0';
    }
  }

  // ancho de columnas
  ws["!cols"] = [
    { wch: 14 }, // tipificacion
    { wch: 10 }, // inmueble
    { wch: 28 }, // nombre
    ...Array(13).fill({ wch: 12 }), // capital + 12 meses
    { wch: 14 }, // total
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Reporte ${year}`);
  XLSX.writeFile(wb, nombreArchivo);
}
