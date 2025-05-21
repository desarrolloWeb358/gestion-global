// src/modules/cobranza/components/AgreementGrid.tsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, NewValueParams } from 'ag-grid-community';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';

// Registrar módulos community de AG Grid
ModuleRegistry.registerModules([AllCommunityModule]);

import { Inmueble } from '../models/inmueble.model';
import {
  actualizarFechaCuota,
  actualizarCuotaField,
} from '../services/agreementService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase'; // Ajusta la ruta según la ubicación de tu archivo firebase.ts

interface AgreementGridProps {
  inmueble: Inmueble;
  onDataChange: () => void;
}

export default function AgreementGrid({ inmueble, onDataChange }: AgreementGridProps) {
  const gridApi = useRef<any>(null);
  type Cuota =
    | { pagado: boolean; mes: string; valor_esperado: number; fecha_limite?: string; observacion?: string }
    | { numero_cuota: number; fecha_limite: string; deuda_capital: number; cuota_capital: number; deuda_honorarios: number; cuota_honorarios: number; cuota_acuerdo: number; pagado: boolean };

  const [rowData, setRowData] = useState<Cuota[]>(inmueble.acuerdo_pago?.cuotas || []);
  const [pinnedBottomData, setPinnedBottomData] = useState<any[]>([]);

  // Refresca datos y suma totales
  useEffect(() => {
    const cuotas = Array.isArray(inmueble.acuerdo_pago?.cuotas) ? inmueble.acuerdo_pago.cuotas : [];
    setRowData(cuotas);
    // Calcular totales
    const totalCapital = cuotas.reduce((sum, c) => sum + (typeof (c as any).cuota_capital === 'number' ? (c as any).cuota_capital : 0), 0);
    // Si tienes propiedades diferentes para honorarios y acuerdo, cámbialas aquí también
    const totalHonorarios = cuotas.reduce((sum, c) => sum + (typeof (c as any).cuota_honorarios === 'number' ? (c as any).cuota_honorarios : 0), 0);
    const totalAcuerdo = cuotas.reduce((sum, c) => sum + (typeof (c as any).cuota_acuerdo === 'number' ? (c as any).cuota_acuerdo : 0), 0);
    setPinnedBottomData([
      {
        numero_cuota: 'Totales',
        cuota_capital: totalCapital,
        cuota_honorarios: totalHonorarios,
        cuota_acuerdo: totalAcuerdo,
      },
    ]);
  }, [inmueble]);

  // Column definitions con edición de fila completa
  const columnDefs = useMemo<ColDef[]>(
    () => [
      { headerName: 'No. Cuota', field: 'numero_cuota', editable: false, width: 100 },
      {
        headerName: 'Fecha Pago', field: 'fecha_limite', editable: true,
        cellEditor: 'agDateCellEditor', cellEditorParams: { dateParser: (d:string) => d },
        onCellValueChanged: (params: NewValueParams<any>) => {
          const idx = rowData.findIndex(row => row === params.data);
          if (idx !== -1) {
            actualizarFechaCuota(inmueble.id!, idx, params.newValue as string)
              .then(() => {
                // Opcional: actualizar solo el rowData localmente
                const updated = [...rowData];
                updated[idx] = { ...updated[idx], fecha_limite: params.newValue };
                setRowData(updated);
              });
          }
        }
      },
      { headerName: 'Deuda Capital', field: 'deuda_capital', editable: false },

      { headerName: 'Cuota Capital', field: 'cuota_capital', editable: false,
        valueGetter: params => {
          const deuda = Number(params.data?.deuda_capital) || 0;
          const honorarios = Number(params.data?.cuota_honorarios) || 0;
          return deuda - honorarios;
        }
      },

      { headerName: 'Cuota Honorarios', field: 'cuota_honorarios', editable: true,
        onCellValueChanged: (params: NewValueParams<any>) => {
          const idx = rowData.findIndex(row => row === params.data);
          if (idx !== -1) {
            actualizarCuotaField(inmueble.id!, idx, 'cuota_honorarios', Number(params.newValue))
              .then(() => {
                const updated = [...rowData];
                updated[idx] = { ...updated[idx], cuota_honorarios: Number(params.newValue) };
                setRowData(updated);
              });
          }
        }
      },

      { headerName: 'Cuota Acuerdo', field: 'cuota_acuerdo', editable: true,
        onCellValueChanged: (params: NewValueParams<any>) => {
          const idx = rowData.findIndex(row => row === params.data);
          if (idx !== -1) {
            actualizarCuotaField(inmueble.id!, idx, 'cuota_acuerdo', Number(params.newValue))
              .then(() => {
                const updated = [...rowData];
                updated[idx] = { ...updated[idx], cuota_acuerdo: Number(params.newValue) };
                setRowData(updated);
              });
          }
        }
      },
      // Pagada column removed
    ], [inmueble, rowData]
  );

  // Añadir nueva fila
  const addRow = () => {
    const newRow = {
      numero_cuota: rowData.length + 1,
      fecha_limite: new Date().toISOString().slice(0,10),
      deuda_capital: 0,
      cuota_capital: 0,
      deuda_honorarios: 0,
      cuota_honorarios: 0,
      cuota_acuerdo: 0,
      pagado: false,
    };
    const updated = [...rowData, newRow];
    setRowData(updated);
    // Guardar la lista completa
    doc(db, 'inmuebles', inmueble.id!);
    // Persistir nueva lista en Firestore
    updateDoc(doc(db, 'inmuebles', inmueble.id!), { 'acuerdo_pago.cuotas': updated }).then(onDataChange);
  };

  return (
    <>
      <button onClick={addRow} className="mb-2 px-4 py-2 bg-blue-600 text-white rounded">Agregar Cuota</button>
      <div className="ag-theme-alpine" style={{ width: '100%', height: 450 }}>
        <AgGridReact
          ref={gridApi}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{ resizable: true, sortable: true, editable: true }}
          rowSelection="single"
          editType="fullRow"
          pinnedBottomRowData={pinnedBottomData}
          onGridReady={params => (gridApi.current = params.api)}
          onRowValueChanged={(params: any) => {
            // Al cambiar fila completa, persiste todos los campos
            const idx = params.rowIndex;
            const updatedRow = params.data;
            // Actualizar todos los campos de cuota
            updateDoc(doc(db, 'inmuebles', inmueble.id!), {
              [`acuerdo_pago.cuotas.${idx}`]: updatedRow,
            }); // No llamamos onDataChange para evitar recarga
            // Actualizar localmente
            const updated = [...rowData];
            updated[idx] = updatedRow;
            setRowData(updated);
          }}
        />
      </div>
    </>
  );
}
