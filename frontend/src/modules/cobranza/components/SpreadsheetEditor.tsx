// src/modules/cobranza/components/SpreadsheetEditor.tsx
import * as jexcelNS from 'jspreadsheet-ce';
const jexcel = (jexcelNS as any).default || jexcelNS;
(window as any).jspreadsheet = jexcel;
(window as any).JSS = jexcel;
import 'jspreadsheet-ce/dist/jspreadsheet.css';
import { useRef, useEffect } from 'react';
import { Inmueble } from '../models/inmueble.model';

interface SpreadsheetEditorProps {
  inmueble: Inmueble;
  onSave: () => void;
}

export default function SpreadsheetEditor({ inmueble, onSave }: SpreadsheetEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if ((containerRef.current as any).jexcel && typeof (containerRef.current as any).jexcel.destroy === 'function') {
      (containerRef.current as any).jexcel.destroy();
    }

    containerRef.current.innerHTML = '';

    if (!document.querySelector('link[href*="jspreadsheet.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/jspreadsheet-ce/dist/jspreadsheet.css';
      document.head.appendChild(link);
    }

    (window as any).jspreadsheet = jexcel;
    (window as any).JSS = jexcel;

    const rows: (string | number)[][] = inmueble.acuerdo_pago?.cuotas.map((c, idx) => [
      idx + 1,
      c.fecha_limite ?? '',
      c.valor_esperado ?? 0,
      0,
      0,
      0,
      0,
    ]) || [];

    const totals: (string | number)[] = [
      'Totales',
      '',
      rows.reduce((sum: number, r: (string | number)[]) => sum + Number(r[2]), 0),
      rows.reduce((sum: number, r: (string | number)[]) => sum + Number(r[3]), 0),
      rows.reduce((sum: number, r: (string | number)[]) => sum + Number(r[4]), 0),
      rows.reduce((sum: number, r: (string | number)[]) => sum + Number(r[5]), 0),
      rows.reduce((sum: number, r: (string | number)[]) => sum + Number(r[6]), 0),
    ];

    const timeout = setTimeout(() => {
      try {
        sheetRef.current = jexcel(containerRef.current as HTMLDivElement, {
          data: [...rows, totals],
          columns: [
            { type: 'numeric', title: 'No. CUOTAS', width: 80 },
            { type: 'calendar', title: 'FECHA DE PAGOS', width: 120, options: { format: 'dd/mm/yyyy' } },
            { type: 'numeric', title: 'DEUDA CAPITAL', width: 120, mask: '$ #,##0' },
            { type: 'numeric', title: 'CUOTA CAPITAL', width: 120, mask: '$ #,##0' },
            { type: 'numeric', title: 'DEUDA HONORARIOS', width: 140, mask: '$ #,##0' },
            { type: 'numeric', title: 'CUOTA HONORARIOS', width: 140, mask: '$ #,##0' },
            { type: 'numeric', title: 'CUOTA ACUERDO', width: 140, mask: '$ #,##0' },
          ],
          minDimensions: [7, rows.length + 1],
          allowInsertRow: true,
          allowDeleteRow: true,
          cellLock: (_cell: any, _value: any, _x: number, y: number): boolean => y === rows.length,
        } as any);
      } catch (err) {
        console.error('Error initializing jspreadsheet:', err);
      }
    }, 0);

    return () => {
      clearTimeout(timeout);
      if (containerRef.current && (containerRef.current as any).jexcel && typeof (containerRef.current as any).jexcel.destroy === 'function') {
        (containerRef.current as any).jexcel.destroy();
      }
    };
  }, [inmueble]);

  const handleSave = async () => {
    const spreadsheet = (containerRef.current as any)?.jexcel;
    if (!spreadsheet || typeof spreadsheet.getData !== 'function') {
      console.error('Spreadsheet instance not found or getData is not a function');
      return;
    }

    // const data: any[][] = spreadsheet.getData();
    // const cuotas = data.slice(0, -1).map(r => ({
    //   numero_cuota: Number(r[0]),
    //   fecha_limite: String(r[1]),
    //   deuda_capital: Number(r[2]),
    //   cuota_capital: Number(r[3]),
    //   deuda_honorarios: Number(r[4]),
    //   cuota_honorarios: Number(r[5]),
    //   cuota_acuerdo: Number(r[6]),
    //   observacion: '',
    //   pagado: false,
    // }));

    onSave();
  };

  return (
    <div>
      <div ref={containerRef} />
      <button
        onClick={handleSave}
        className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
      >
        Guardar Cambios
      </button>
    </div>
  );
}
