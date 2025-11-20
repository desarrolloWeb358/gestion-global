// src/modules/cobranza/pages/TablaDeudoresReporte.tsx
import { useEffect, useState } from "react";
import { obtenerReporteDeudoresPorAnio } from "../../services/reportes/reporteDeudoresService";
import type { FilaReporte } from "../../services/reportes/tipos";
import { Button } from "@/shared/ui/button";
import { exportarExcel } from "../../services/reportes/exportExcel";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ==== CONFIG VISUAL ====
// Solo 2 columnas sticky
const COLW = {
  tip: 180,   // Tipificación
  inm: 140,   // Inmueble
  nom: 280,   // Nombre (más corto)
};

// offsets sticky
const LEFTS = {
  tip: 0,
  inm: 180, // = COLW.tip
};

// Anchos dinero
const W_CAPITAL = 140;
const W_MES     = 140;
const W_TOTAL   = 160;

const ROW_H = 46;
const HEADER_H = 48;
const VISIBLE_ROWS = 10;
const CONTAINER_H = HEADER_H + ROW_H * VISIBLE_ROWS;

export default function TablaDeudoresReporte({ clienteId }: { clienteId: string }) {
  const hoy = new Date();
  const [year, setYear] = useState(hoy.getFullYear());
  const [rows, setRows] = useState<FilaReporte[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await obtenerReporteDeudoresPorAnio(clienteId, year);
      setRows(data);
      setLoading(false);
    })();
  }, [clienteId, year]);

  const formatCOP = (v: number) => `$ ${v.toLocaleString("es-CO")}`;
  const handleExport = () => exportarExcel(rows, year);

  return (
    <div className="p-4 space-y-4">
      {/* Filtros y acciones */}
      <div className="flex items-center gap-3">
        <label className="text-sm">Año:</label>
        <select
          className="border rounded px-2 py-1"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          <option>{hoy.getFullYear()}</option>
          <option>{hoy.getFullYear() - 1}</option>
          <option>{hoy.getFullYear() - 2}</option>
        </select>

        <Button onClick={handleExport}>Exportar a Excel</Button>
      </div>

      {/* Tabla con scroll: EXACTAMENTE 10 filas visibles */}
      <div className="overflow-auto border rounded" style={{ height: CONTAINER_H }}>
        {/* border-collapse evita espacios fantasma */}
        <table className="min-w-[1750px] w-full text-sm table-fixed border-collapse">
          <thead>
            <tr
              style={{ height: HEADER_H }}
              className="text-left text-sm font-semibold bg-background"
            >
              {/* Tipificación (sticky col 1) */}
              <th
                className="sticky top-0 z-40 px-3 py-2 whitespace-nowrap bg-background border-b
                           shadow-[inset_-1px_0_0_#e5e7eb] border-r border-gray-200"
                style={{ width: COLW.tip, left: LEFTS.tip }}
              >
                Tipificación
              </th>

              {/* Inmueble (sticky col 2) */}
              <th
                className="sticky top-0 z-40 px-3 py-2 whitespace-nowrap bg-background border-b
                           shadow-[inset_-1px_0_0_#e5e7eb] border-r border-gray-200"
                style={{ width: COLW.inm, left: LEFTS.inm }}
              >
                Inmueble
              </th>

              {/* Desde aquí todo se desplaza */}
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

              {MESES.map((m) => (
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
                <td className="px-3 py-2" colSpan={16}>Cargando…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr style={{ height: ROW_H }}>
                <td className="px-3 py-2" colSpan={16}>Sin datos</td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={idx} className="odd:bg-muted/20 border-b" style={{ height: ROW_H }}>
                  {/* Tipificación (sticky) */}
                  <td
                    className="sticky z-20 px-3 py-2 bg-background whitespace-nowrap
                               shadow-[inset_-1px_0_0_#e5e7eb] border-r border-gray-200"
                    style={{ left: LEFTS.tip, width: COLW.tip }}
                  >
                    {r.tipificacion}
                  </td>

                  {/* Inmueble (sticky) */}
                  <td
                    className="sticky z-20 px-3 py-2 bg-background whitespace-nowrap
                               shadow-[inset_-1px_0_0_#e5e7eb] border-r border-gray-200"
                    style={{ left: LEFTS.inm, width: COLW.inm }}
                  >
                    {r.inmueble}
                  </td>

                  {/* Nombre (ancho fijo + ellipsis) */}
                  <td
                    className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis border-r border-gray-200"
                    style={{ width: COLW.nom }}
                    title={r.nombre}
                  >
                    {r.nombre}
                  </td>

                  <td
                    className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-200"
                    style={{ minWidth: W_CAPITAL }}
                  >
                    {formatCOP(r.capitalEnero)}
                  </td>

                  {/* Meses */}
                  <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-200" style={{ minWidth: W_MES }}>{formatCOP(r.rec_01)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-200" style={{ minWidth: W_MES }}>{formatCOP(r.rec_02)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-200" style={{ minWidth: W_MES }}>{formatCOP(r.rec_03)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-200" style={{ minWidth: W_MES }}>{formatCOP(r.rec_04)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-200" style={{ minWidth: W_MES }}>{formatCOP(r.rec_05)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-200" style={{ minWidth: W_MES }}>{formatCOP(r.rec_06)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-200" style={{ minWidth: W_MES }}>{formatCOP(r.rec_07)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-200" style={{ minWidth: W_MES }}>{formatCOP(r.rec_08)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-200" style={{ minWidth: W_MES }}>{formatCOP(r.rec_09)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-200" style={{ minWidth: W_MES }}>{formatCOP(r.rec_10)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-200" style={{ minWidth: W_MES }}>{formatCOP(r.rec_11)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap border-r border-gray-200" style={{ minWidth: W_MES }}>{formatCOP(r.rec_12)}</td>

                  <td
                    className="px-3 py-2 text-right font-medium whitespace-nowrap text-red-600"
                    style={{ minWidth: W_TOTAL }}
                  >
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
