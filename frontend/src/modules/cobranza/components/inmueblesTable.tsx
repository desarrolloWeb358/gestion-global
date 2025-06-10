import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import { Box, Button, IconButton, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import HistoryIcon from '@mui/icons-material/History';
import { Inmueble } from '../models/inmueble.model';
import {
  obtenerInmueblesPorCliente,
  crearInmueble,
  actualizarInmueble,
  eliminarInmueble,
} from '../services/inmuebleService';

export default function InmueblesTable() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const navigate = useNavigate();
  const [inmuebles, setInmuebles] = useState<Inmueble[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInmuebles = async () => {
    if (!clienteId) return;
    setLoading(true);
    const data = await obtenerInmueblesPorCliente(clienteId);
    setInmuebles(data);
    setLoading(false);
  };

  useEffect(() => { fetchInmuebles(); }, [clienteId]);

  const columns = useMemo<MRT_ColumnDef<Inmueble>[]>(
    () => [
      { accessorKey: 'torre', header: 'Torre' },
      { accessorKey: 'apartamento', header: 'Apartamento' },
      { accessorKey: 'casa', header: 'Casa' },
      { accessorKey: 'responsable', header: 'Responsable' },
      { accessorKey: 'estado', header: 'estado' },
      {
        accessorKey: 'deuda_total',
        header: 'Deuda Total',
        Cell: ({ cell }) => `$${cell.getValue<number>()}`,
      },
      {
        accessorKey: 'correos',
        header: 'Correos',
        Cell: ({ cell }) => (cell.getValue<string[]>() || []).join(', '),
      },
      {
        accessorKey: 'telefonos',
        header: 'Teléfonos',
        Cell: ({ cell }) => (cell.getValue<string[]>() || []).join(', '),
      },
      {
        accessorKey: 'nombreResponsable',
        header: 'Nombre Responsable',
      },
      {
        accessorKey: 'cedulaResponsable',
        header: 'Cédula Responsable',
      },
      {
        accessorKey: 'correoResponsable',
        header: 'Correo Responsable',
      },
      {
        accessorKey: 'telefonoResponsable',
        header: 'Teléfono Responsable',
      },
    ],
    []
  );

  return (
    <MaterialReactTable<Inmueble>
      columns={columns}
      data={inmuebles}
      getRowId={(row) => row.id!}
      state={{ isLoading: loading }}
      enableEditing
      enableColumnActions={false}
      enableColumnFilters={false}
      renderRowActions={({ row, table }) => (
        <Box sx={{ display: 'flex', gap: '0.5rem' }}>
          <Tooltip title="Ver Acuerdo">
            <IconButton onClick={() => navigate(`/inmuebles/${clienteId}/${row.original.id}/acuerdo`)}>
              <VisibilityIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Seguimiento">
            <IconButton onClick={() => navigate(`/inmuebles/${clienteId}/${row.original.id}/seguimiento`)}>
              <HistoryIcon /> {/* puedes cambiar el ícono por uno más representativo como <HistoryIcon /> */}
            </IconButton>
          </Tooltip>
          <Tooltip title="Editar">
            <IconButton onClick={() => table.setEditingRow(row)}>
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton
              color="error"
              onClick={async () => {
                await eliminarInmueble(clienteId!, row.original.id!);
                fetchInmuebles();
              }}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      renderTopToolbarCustomActions={({ table }) => (
        <Button onClick={() => table.setCreatingRow(true)}>Crear Inmueble</Button>
      )}
      onCreatingRowSave={async ({ values, table }) => {
        // Ensure nombreResponsable is always a string
        const safeValues = {
          ...values,
          nombreResponsable: values.nombreResponsable ?? '',
        };
        await crearInmueble(clienteId!, safeValues as Inmueble);
        table.setCreatingRow(null);
        fetchInmuebles();
      }}
      onEditingRowSave={async ({ values, row, table }) => {
        // Ensure nombreResponsable is always a string
        const safeValues = {
          ...values,
          nombreResponsable: values.nombreResponsable ?? '',
        };
        await actualizarInmueble(clienteId!, {
          ...safeValues,
          id: row.original.id!,
        } as Inmueble);
        table.setEditingRow(null);
        fetchInmuebles();
      }}
    />
  );
}
