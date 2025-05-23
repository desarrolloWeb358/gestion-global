// src/modules/cobranza/components/AgreementTableGrid.tsx
import { GridColDef } from '@mui/x-data-grid';
import { GridRenderCellParams } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import { DataGrid } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import { Button } from '@mui/material';
import React from 'react';
import { guardarAcuerdoPago } from '../services/inmuebleService';

interface AgreementRow {
    id: number | string; // <-- Agrega id aquí
    numero_cuota: number;
    fecha_limite: Date | string;
    deuda_capital: number;
    cuota_capital: number;
    deuda_honorarios: number;
    cuota_honorarios: number;
    cuota_acuerdo: number;
    _isTotals?: boolean;
}

interface AgreementTableGridProps {
    inmueble: any;
    onSave: () => void;
}

const AgreementTableGrid = ({ inmueble, onSave, clienteId, inmuebleId }: AgreementTableGridProps & { clienteId: string, inmuebleId: string }) => {
    const [rows, setRows] = React.useState(() =>
        (inmueble.acuerdo_pago?.cuotas || []).map((c: any, idx: number) => ({
            id: c.id ?? idx + 1,
            numero_cuota: c.numero_cuota ?? idx + 1,
            fecha_limite: c.fecha_limite ? new Date(c.fecha_limite) : null,
            deuda_capital: idx === 0 ? inmueble.deuda_total ?? 0 : 0,
            cuota_capital: c.cuota_capital ?? 0,
            deuda_honorarios: c.deuda_honorarios ?? 0,
            cuota_honorarios: c.cuota_honorarios ?? 0,
            cuota_acuerdo: c.cuota_acuerdo ?? 0,
            _isTotals: false,
        }))
    );

    // Eliminar fila
    const handleDeleteRow = (id: number | string) => {
        setRows(rows.filter(r => r.id !== id));
    };

    // Agregar fila
    const handleAddRow = () => {
        setRows(prevRows => {
            const dataRows = prevRows.filter(r => !r._isTotals);
            const nextId = dataRows.length ? Math.max(...dataRows.map(r => Number(r.id) || 0)) + 1 : 1;
            return [
                ...dataRows,
                {
                    id: nextId,
                    numero_cuota: nextId,
                    fecha_limite: null,
                    deuda_capital: 0,
                    cuota_capital: 0,
                    deuda_honorarios: 0,
                    cuota_honorarios: 0,
                    cuota_acuerdo: 0,
                    _isTotals: false,
                }
            ];
        });
    };

    // Corrige el número de cuota al renderizar y asegura que la primera fila tenga deuda_capital igual a inmueble.deuda_total
    const displayRows = rows.map((row, idx) => {
        if (row._isTotals) return row;
        return {
            ...row,
            numero_cuota: idx + 1,
            deuda_capital: idx === 0 ? inmueble.deuda_total ?? 0 : row.deuda_capital,
        };
    });

    // Calcular totales
    const totals = {
        id: 'totals',
        numero_cuota: 'Totales',
        fecha_limite: '',
        deuda_capital: displayRows.reduce((sum, r) => sum + (Number(r.deuda_capital) || 0), 0),
        cuota_capital: displayRows.reduce((sum, r) => sum + (Number(r.cuota_capital) || 0), 0),
        deuda_honorarios: displayRows.reduce((sum, r) => sum + (Number(r.deuda_honorarios) || 0), 0),
        cuota_honorarios: displayRows.reduce((sum, r) => sum + (Number(r.cuota_honorarios) || 0), 0),
        cuota_acuerdo: displayRows.reduce((sum, r) => sum + (Number(r.cuota_acuerdo) || 0), 0),
        _isTotals: true,
    };

    // Guardar cambios en Firestore
    const handleSaveToFirestore = async () => {
        // Solo las filas de datos, sin la de totales
        const cuotas = rows.filter(r => !r._isTotals).map(row => ({
            ...row,
            // Asegura formato correcto para Firestore
            fecha_limite: row.fecha_limite instanceof Date ? row.fecha_limite.toISOString().slice(0,10) : row.fecha_limite,
        }));
        const acuerdo_pago = {
            ...inmueble.acuerdo_pago,
            cuotas,
        };
        await guardarAcuerdoPago(clienteId, inmuebleId, acuerdo_pago);
        if (onSave) onSave();
    };

    // Definir columnas dentro del componente para acceder a handleDeleteRow
    const columns: GridColDef<AgreementRow>[] = [
        {
            field: 'numero_cuota',
            headerName: 'No. CUOTAS',
            width: 100,
            editable: false,
            renderCell: (params: GridRenderCellParams<AgreementRow, AgreementRow['numero_cuota']>) =>
                params.row._isTotals ? <strong>{params.value}</strong> : params.value,
        },
        {
            field: 'fecha_limite',
            headerName: 'FECHA DE PAGOS',
            width: 120,
            editable: true,
            type: 'date',
        },
        {
            field: 'deuda_capital',
            headerName: 'DEUDA CAPITAL',
            width: 130,
            editable: false,
            type: 'number',
            valueFormatter: ({ value }: { value: any }) => `$ ${Number(value).toLocaleString()}`,
        },
        {
            field: 'cuota_capital',
            headerName: 'CUOTA CAPITAL',
            width: 130,
            editable: true,
            type: 'number',
            valueFormatter: ({ value }: { value: any }) => `$ ${Number(value).toLocaleString()}`,
        },
        {
            field: 'deuda_honorarios',
            headerName: 'DEUDA HONORARIOS',
            width: 140,
            editable: false,
            type: 'number',
            valueFormatter: ({ value }: { value: any }) => `$ ${Number(value).toLocaleString()}`,
        },
        {
            field: 'cuota_honorarios',
            headerName: 'CUOTA HONORARIOS',
            width: 140,
            editable: true,
            type: 'number',
            valueFormatter: ({ value }: { value: any }) => `$ ${Number(value).toLocaleString()}`,
        },
        {
            field: 'cuota_acuerdo',
            headerName: 'CUOTA ACUERDO',
            width: 140,
            editable: true,
            type: 'number',
            valueFormatter: ({ value }: { value: any }) => `$ ${Number(value).toLocaleString()}`,
        },
        {
            field: 'actions',
            headerName: 'Eliminar',
            width: 100,
            sortable: false,
            filterable: false,
            renderCell: (params: GridRenderCellParams<AgreementRow>) =>
                params.row._isTotals ? null : (
                    <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteRow(params.row.id)}
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                ),
        },
    ];

    return (
        <Box sx={{ width: '100%', minHeight: 400 }}>
            <Button
                startIcon={<AddIcon />}
                variant="contained"
                sx={{ mb: 1, mr: 1 }}
                onClick={handleAddRow}
            >
                Agregar fila
            </Button>
            <Button
                variant="outlined"
                sx={{ mb: 1 }}
                onClick={handleSaveToFirestore}
            >
                Guardar cambios
            </Button>
            <DataGrid
                autoHeight={false}
                rows={[...displayRows, totals]}
                columns={columns}
                initialState={{
                    pagination: { paginationModel: { pageSize: displayRows.length + 1 } }
                }}
                pagination={true}
                hideFooter
                disableRowSelectionOnClick
                sx={{ minHeight: 400, height: Math.max(400, 56 * (displayRows.length + 2)) }}
            />
        </Box>
    );
};

export default AgreementTableGrid;
