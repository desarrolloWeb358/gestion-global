// src/modules/cobranza/pages/TablaDeudoresReporte.tsx
import { useEffect, useMemo, useState } from "react";
import { obtenerReporteDeudoresPorPeriodo } from "../../services/reportes/reporteDeudoresService";
import type { FilaReporte } from "../../services/reportes/tipos";
import { Button } from "@/shared/ui/button";
import { exportarExcel } from "../../services/reportes/exportExcel";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ==== CONFIG VISUAL ====
const COLW = { tip: 180, inm: 140, nom: 280 };
const LEFTS = { tip: 0, inm: 180 };
const W_CAPITAL = 140;
const W_MES     = 140;
const W_TOTAL   = 160;

const ROW_H = 46;
const HEADER_H = 48;
const VISIBLE_ROWS = 10;
const CONTAINER_H = HEADER_H + ROW_H * VISIBLE_ROWS;

export default function TablaDeudoresReporte({
  clienteId,
  year,
  month, // 1..12
}: {
  clienteId: string;
  year: number;
  month: number;
}) {
  const [rows, setRows] = useState<FilaReporte[]>([]);
  const [loading, setLoading] = useState(false);

  const mesesVisibles = useMemo(() => MESES.slice(0, Math.max(1, Math.min(12, month))), [month]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await obtenerReporteDeudoresPorPeriodo(clienteId, year, month);
      setRows(data);
      setLoading(false);
    })();
  }, [clienteId, year, month]);

  const formatCOP = (v: number) => `$ ${Number(v ?? 0).toLocaleString("es-CO")}`;

  // ✅ recomendado: exportar con el mismo corte
  const handleExport = () => exportarExcel(rows, year, month);

  // helper para mapear rec_01..rec_12
  const getRec = (r: FilaReporte, idx1based: number) => {
    const key = `rec_${String(idx1based).padStart(2, "0")}` as keyof FilaReporte;
    return Number(r[key] ?? 0);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Acciones */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground">
          Corte: <span className="font-medium text-foreground">{year}</span> -{" "}
          <span className="font-medium text-foreground">{mesesVisibles[month - 1] ?? mesesVisibles[mesesVisibles.length - 1]}</span>
        </div>

        <Button onClick={handleExport}>Exportar a Excel</Button>
      </div>

      {/* Tabla con scroll */}
      <div
        className="overflow-auto border rounded"
        style={{
          height: rows.length > VISIBLE_ROWS ? CONTAINER_H : "auto",
          maxHeight: CONTAINER_H,
        }}
      >
        <table className="min-w-[1750px] w-full text-sm table-fixed border-collapse">
          <thead>
            <tr style={{ height: HEADER_H }} className="text-left text-sm font-semibold bg-background">
              <th
                className="sticky top-0 z-40 px-3 py-2 whitespace-nowrap bg-background border-b
                           shadow-[inset_-1px_0_0_#e5e7eb] border-r border-gray-200"
                style={{ width: COLW.tip, left: LEFTS.tip }}
              >
                Tipificación
              </th>

              <th
                className="sticky top-0 z-40 px-3 py-2 whitespace-nowrap bg-background border-b
                           shadow-[inset_-1px_0_0_#e5e7eb] border-r border-gray-200"
                style={{ width: COLW.inm, left: LEFTS.inm }}
              >
                Inmueble
              </th>

              <th
                className="sticky top-0 z-30 px-3 py-2 whitespace-nowrap bg-background border-b border-r border-gray-200"
                style={{ width: COLW.nom }}
              >
                Nombre
              </th>

              <th
                className="sticky top-0 z-30 px-3 py-2 text-right bg-background border-b border-r border-gray-200"
                style={{ minWidth: W_CAPITAL }}
              >
                Por Recaudar
              </th>

              {/* ✅ Solo meses hasta el corte */}
              {mesesVisibles.map((m) => (
                <th
                  key={m}
                  className="sticky top-0 z-30 px-3 py-2 text-right bg-background border-b border-r border-gray-200"
                  style={{ minWidth: W_MES }}
                >
                  {m}
                </th>
              ))}

              <th
                className="sticky top-0 z-30 px-3 py-2 text-right bg-background border-b text-red-600"
                style={{ minWidth: W_TOTAL }}
              >
                Recaudo Total
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr style={{ height: ROW_H }}>
                <td className="px-3 py-2" colSpan={4 + mesesVisibles.length + 1}>Cargando…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr style={{ height: ROW_H }}>
                <td className="px-3 py-2" colSpan={4 + mesesVisibles.length + 1}>Sin datos</td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={idx} className="odd:bg-muted/20 border-b" style={{ height: ROW_H }}>
                  <td
                    className="sticky z-20 px-3 py-2 bg-background whitespace-nowrap
                               shadow-[inset_-1px_0_0_#e5e7eb] border-r border-gray-200"
                    style={{ left: LEFTS.tip, width: COLW.tip }}
                  >
                    {r.tipificacion}
                  </td>

                  <td
                    className="sticky z-20 px-3 py-2 bg-background whitespace-nowrap
                               shadow-[inset_-1px_0_0_#e5e7eb] border-r border-gray-200"
                    style={{ left: LEFTS.inm, width: COLW.inm }}
                  >
                    {r.inmueble}
                  </td>

                  <td
                    className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis border-r border-gray-200"
                    style={{ width: COLW.nom }}
                    title={r.nombre}
                  >
                    {r.nombre}
                  </td>

                  <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-200" style={{ minWidth: W_CAPITAL }}>
                    {formatCOP(r.porRecaudar)}
                  </td>

                  {/* ✅ Solo meses hasta el corte */}
                  {Array.from({ length: mesesVisibles.length }).map((_, i) => (
                    <td key={i} className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-200" style={{ minWidth: W_MES }}>
                      {formatCOP(getRec(r, i + 1))}
                    </td>
                  ))}

                  <td className="px-3 py-2 text-right font-medium whitespace-nowrap text-red-600" style={{ minWidth: W_TOTAL }}>
                    {formatCOP(r.recaudoTotal)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
