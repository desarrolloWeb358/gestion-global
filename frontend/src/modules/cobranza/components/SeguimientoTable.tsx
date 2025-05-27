// src/pages/SeguimientoTable.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, IconButton, Tooltip, Button } from '@mui/material';
import { MaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import { Delete as DeleteIcon, Edit as EditIcon, Add as AddIcon } from '@mui/icons-material';
import { Timestamp } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { Seguimiento } from '../models/seguimiento.model';
import {
  getSeguimientos,
  addSeguimiento,
  updateSeguimiento,
  deleteSeguimiento,
} from '../services/seguimientoService';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import SeguimientoForm from '../components/SeguimientoForm';
import { storage } from '../../../firebase';
import { uploadBytes, getDownloadURL } from 'firebase/storage';

// 👇 Tipo personalizado para meta
type TableMetaCustom = {
  updateData: (rowIndex: number, columnId: string, value: any) => void;
};

export default function SeguimientoTable() {
  const { clienteId, inmuebleId } = useParams<{ clienteId: string; inmuebleId: string }>();
  const [tableData, setTableData] = useState<Seguimiento[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [seguimientoActual, setSeguimientoActual] = useState<Seguimiento | null>(null);

  const fetchData = async () => {
    if (!clienteId || !inmuebleId) return;
    setLoading(true);
    const data = await getSeguimientos(clienteId, inmuebleId);
    setTableData(data);
    setLoading(false);
  };

  const updateData = (rowIndex: number, columnId: string, value: any) => {
    setTableData((prev) =>
      prev.map((row, index) => (index === rowIndex ? { ...row, [columnId]: value } : row))
    );
  };

  useEffect(() => { fetchData(); }, [clienteId, inmuebleId]);

  const columns = useMemo<MRT_ColumnDef<Seguimiento>[]>(() => [
    {
      accessorKey: 'fecha',
      header: 'Fecha',
      Cell: ({ cell }) => {
        const f = cell.getValue<Timestamp>();
        return f?.toDate().toLocaleDateString();
      },
      Edit: ({ row, table }) => (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            value={
              row.original.fecha instanceof Timestamp
                ? row.original.fecha.toDate()
                : new Date()
            }
            onChange={(date) => {
              (table.options.meta as TableMetaCustom)?.updateData(row.index, 'fecha', Timestamp.fromDate(date!));
            }}
          />
        </LocalizationProvider>
      )
    },
    {
      accessorKey: 'tipo',
      header: 'Tipo',
      editVariant: 'select',
      editSelectOptions: ['llamada', 'correo', 'whatsapp', 'sms', 'visita', 'otro']
    },
    {
      accessorKey: 'descripcion',
      header: 'Descripción'
    },
    {
      accessorKey: 'archivoUrl',
      header: 'Archivo',
      Cell: ({ cell }) => {
        const url = cell.getValue<string>();
        return url ? <a href={url} target="_blank" rel="noreferrer">Ver archivo</a> : '-';
      },
      Edit: () => 'Carga de archivo solo al crear.'
    },
  ], []);

  const handleGuardar = async (data: Omit<Seguimiento, 'id'>, archivo?: File, reemplazarArchivo?: boolean) => {
    if (!clienteId || !inmuebleId) return;

    if (seguimientoActual) {
      // EDITAR
      let nuevaUrl = seguimientoActual.archivoUrl;

      if (archivo && reemplazarArchivo && seguimientoActual.archivoUrl) {
        try {
          await deleteObject(ref(storage, seguimientoActual.archivoUrl));
        } catch (e) {
          console.warn('No se pudo eliminar archivo anterior:', e);
        }

        const storageRef = ref(storage, `seguimientos/${clienteId}/${inmuebleId}/${Date.now()}_${archivo.name}`);


        const uploadResult = await uploadBytes(storageRef, archivo);
        nuevaUrl = await getDownloadURL(uploadResult.ref);


      } else if (archivo && reemplazarArchivo) {
        const storageRef = ref(storage, `seguimientos/${clienteId}/${inmuebleId}/${Date.now()}_${archivo.name}`);

        const uploadResult = await uploadBytes(storageRef, archivo);
        nuevaUrl = await getDownloadURL(uploadResult.ref);

      }

      await updateSeguimiento(clienteId, inmuebleId, seguimientoActual.id!, {
        ...data,
        archivoUrl: nuevaUrl,
      });
    } else {
      await addSeguimiento(clienteId, inmuebleId, data, archivo);
    }

    setSeguimientoActual(null);
    setOpenForm(false);
    fetchData();
  };

  return (
    <>
      <SeguimientoForm
        open={openForm}
        onClose={() => {
          setOpenForm(false);
          setSeguimientoActual(null);
        }}
        onSave={handleGuardar}
        seguimiento={seguimientoActual || undefined}
      />

      <MaterialReactTable<Seguimiento>
        columns={columns}
        data={tableData}
        meta={{ updateData } as TableMetaCustom}
        getRowId={(row) => row.id!}
        state={{ isLoading: loading }}
        enableEditing
        enableColumnActions={false}
        enableColumnFilters={false}
        renderRowActions={({ row }) => (
          <Box sx={{ display: 'flex', gap: '0.5rem' }}>
            <Tooltip title="Editar">
              <IconButton onClick={() => {
                setSeguimientoActual(row.original);
                setOpenForm(true);
              }}>
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Eliminar">
              <IconButton
                color="error"
                onClick={async () => {
                  if (row.original.archivoUrl) {
                    try {
                      await deleteObject(ref(storage, row.original.archivoUrl));
                    } catch (e) {
                      console.warn('No se pudo eliminar el archivo del storage:', e);
                    }
                  }

                  await deleteSeguimiento(clienteId!, inmuebleId!, row.original.id!);
                  fetchData();
                }}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        )}
        renderTopToolbarCustomActions={() => (
          <Button
            color="primary"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setSeguimientoActual(null);
              setOpenForm(true);
            }}
          >
            Crear Seguimiento
          </Button>
        )}
      />
    </>
  );
}
