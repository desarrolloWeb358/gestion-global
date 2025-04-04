import {
  MaterialReactTable,
  useMaterialReactTable,
  MRT_EditActionButtons,
  type MRT_ColumnDef,
  type MRT_Row,
} from 'material-react-table';
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useState } from 'react';

export interface CrudLayoutProps<T extends { id?: string }> {
  title: string;
  columns: MRT_ColumnDef<T>[];
  data: T[];
  onCreate: (nuevo: Omit<T, 'id'>) => Promise<void>;
  onUpdate: (actualizado: T) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const CrudLayout = <T extends { id?: string }>({
  title,
  columns,
  data,
  onCreate,
  onUpdate,
  onDelete,
}: CrudLayoutProps<T>) => {
  const [validationErrors, setValidationErrors] = useState<Record<string, string | undefined>>({});

  const table = useMaterialReactTable({
    columns,
    data,
    getRowId: (row) => row.id ?? '',
    enableEditing: true,
    createDisplayMode: 'modal',
    editDisplayMode: 'modal',
    onCreatingRowSave: async ({ values, table }) => {
      await onCreate(values as Omit<T, 'id'>);
      table.setCreatingRow(null);
    },
    onEditingRowSave: async ({ values, table }) => {
      await onUpdate(values as T);
      table.setEditingRow(null);
    },
    renderCreateRowDialogContent: ({ internalEditComponents, row, table }) => (
      <>
        <DialogTitle>Crear nuevo</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {internalEditComponents}
        </DialogContent>
        <DialogActions>
          <MRT_EditActionButtons table={table} row={row} />
        </DialogActions>
      </>
    ),
    renderEditRowDialogContent: ({ internalEditComponents, row, table }) => (
      <>
        <DialogTitle>Editar</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {internalEditComponents}
        </DialogContent>
        <DialogActions>
          <MRT_EditActionButtons table={table} row={row} />
        </DialogActions>
      </>
    ),
    renderTopToolbarCustomActions: ({ table }) => (
      <Button variant="contained" onClick={() => table.setCreatingRow(true)}>
        Crear
      </Button>
    ),
    renderRowActions: ({ row, table }) => (
      <Box sx={{ display: 'flex', gap: '1rem' }}>
        <Tooltip title="Editar">
          <IconButton onClick={() => table.setEditingRow(row)}>
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Eliminar">
          <IconButton color="error" onClick={() => row.original.id && onDelete(row.original.id)}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Box>
    ),
  });

  return (
    <Box sx={{ p: 2 }}>
      <h2>{title}</h2>
      <MaterialReactTable table={table} />
    </Box>
  );
};

export default CrudLayout;
