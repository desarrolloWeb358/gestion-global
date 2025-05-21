  // src/components/AgreementTable.tsx
  import React from 'react';
  import { MaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
  import Checkbox from '@mui/material/Checkbox';
  import { Inmueble } from '../../cobranza/models/inmueble.model';
  import {
    actualizarFechaCuota,
    actualizarCuotaField,
    marcarCuotaPagada,
  } from '../../cobranza/services/agreementService';
  
  interface AgreementTableProps {
    inmueble: Inmueble;
    onDataChange: () => void;
  }
  
  export default function AgreementTable({ inmueble, onDataChange }: AgreementTableProps) {
    if (!inmueble.acuerdo_pago) return null;
    const cuotas = inmueble.acuerdo_pago.cuotas;
  
    const columns: MRT_ColumnDef<typeof cuotas[0]>[] = [
      {
        accessorKey: 'numero_cuota',
        header: 'No. Cuota',
        Cell: ({ cell }) => <div style={{ textAlign: 'center' }}>{cell.getValue<number>()}</div>,
      },
      {
        accessorKey: 'fecha_limite',
        header: 'Fecha de Pago',
        enableEditing: true,
        Cell: ({ cell, row }) => (
          <input
            type="date"
            value={cell.getValue<string>() || ''}
            onChange={async e => {
              await actualizarFechaCuota(inmueble.id!, row.index, e.target.value);
              onDataChange();
            }}
            style={{ width: '100%', padding: '4px', boxSizing: 'border-box' }}
          />
        ),
      },
      {
        accessorKey: 'deuda_capital',
        header: 'Deuda Capital',
        Cell: ({ cell }) => {
          const val = cell.getValue<number>() ?? 0;
          return val.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
        },
      },
      {
        accessorKey: 'cuota_capital',
        header: 'Cuota Capital',
        enableEditing: true,
        Cell: ({ cell, row }) => (
          <input
            type="number"
            value={cell.getValue<number>()}
            onChange={async e => {
              const newVal = Number(e.target.value);
              await actualizarCuotaField(inmueble.id!, row.index, 'cuota_capital', newVal);
              onDataChange();
            }}
            style={{ width: '100%', padding: '4px', boxSizing: 'border-box' }}
          />
        ),
      },
      {
        accessorKey: 'deuda_honorarios',
        header: 'Deuda Honorarios',
        Cell: ({ cell }) => {
          const val = cell.getValue<number>() ?? 0;
          return val.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
        },
      },
      {
        accessorKey: 'cuota_honorarios',
        header: 'Cuota Honorarios',
        enableEditing: true,
        Cell: ({ cell, row }) => (
          <input
            type="number"
            value={cell.getValue<number>()}
            onChange={async e => {
              const newVal = Number(e.target.value);
              await actualizarCuotaField(inmueble.id!, row.index, 'cuota_honorarios', newVal);
              onDataChange();
            }}
            style={{ width: '100%', padding: '4px', boxSizing: 'border-box' }}
          />
        ),
      },
      {
        accessorKey: 'cuota_acuerdo',
        header: 'Cuota Acuerdo',
        Cell: ({ cell }) => {
          const val = cell.getValue<number>() ?? 0;
          return val.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
        },
      },
      {
        accessorKey: 'pagado',
        header: 'Pagada',
        enableEditing: true,
        Cell: ({ cell, row }) => (
          <Checkbox
            checked={cell.getValue<boolean>() || false}
            onChange={async () => {
              await marcarCuotaPagada(inmueble.id!, row.index);
              onDataChange();
            }}
          />
        ),
      },
    ];
  
    return (
      <div className="p-4 border rounded">
        <h2 className="text-xl font-semibold mb-4">Cronograma de Cuotas</h2>
        <MaterialReactTable
          columns={columns}
          data={cuotas}
          getRowId={(_row, index) => index.toString()}
        />
      </div>
    );
  }
