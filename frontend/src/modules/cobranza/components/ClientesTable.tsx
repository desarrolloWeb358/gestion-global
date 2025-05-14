import { useEffect, useMemo, useState } from "react";
import {
  MaterialReactTable,
  MRT_ColumnDef,
  MRT_EditActionButtons,
} from "material-react-table";
import React from "react";
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { Cliente } from "../models/cliente.model";
import {
  obtenerClientes,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
} from "../services/clienteService";

export default function ClientesCrud() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClientes = async () => {
    setLoading(true);
    const data = await obtenerClientes();
    setClientes(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const columns = useMemo<MRT_ColumnDef<Cliente>[]>(() => [
    { accessorKey: "nombre", header: "Nombre" },
    { accessorKey: "correo", header: "Correo" },
    { accessorKey: "tipo", header: "Tipo", editVariant: "select", editSelectOptions: ["natural", "jurídica"] },
    { accessorKey: "telefono", header: "Teléfono" },
    { accessorKey: "direccion", header: "Dirección" },

  ], []);

  return (
    <MaterialReactTable
      columns={columns}
      data={clientes}
      getRowId={row => row.id!}
      enableEditing
      editDisplayMode="modal"
      createDisplayMode="modal"
      state={{ isLoading: loading }}
      onCreatingRowSave={async ({ values, table }) => {
        await crearCliente(values);
        table.setCreatingRow(null);
        fetchClientes();
      }}
      onEditingRowSave={async ({ values, table }) => {
        await actualizarCliente(values);
        table.setEditingRow(null);
        fetchClientes();
      }}
      renderRowActions={({ row, table }) => (
        <Box sx={{ display: "flex", gap: "1rem" }}>
          <Tooltip title="Editar">
            <IconButton onClick={() => table.setEditingRow(row)}>
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton color="error" onClick={async () => {
              await eliminarCliente(row.original.id!);
              fetchClientes();
            }}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      renderTopToolbarCustomActions={({ table }) => (
        <Button onClick={() => table.setCreatingRow(true)} variant="contained">
          Crear Cliente
        </Button>
      )}
      renderCreateRowDialogContent={({ internalEditComponents, table, row }) => (
        <>
          <DialogTitle>Crear Cliente</DialogTitle>
          <DialogContent sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {internalEditComponents}
          </DialogContent>
          <DialogActions>
            <MRT_EditActionButtons table={table} row={row} />
          </DialogActions>
        </>
      )}
      renderEditRowDialogContent={({ internalEditComponents, table, row }) => (
        <>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogContent sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {internalEditComponents}
          </DialogContent>
          <DialogActions>
            <MRT_EditActionButtons table={table} row={row} />
          </DialogActions>
        </>
      )}
    />
  );
}
