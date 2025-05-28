import React, { useEffect, useMemo, useState } from "react";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useNavigate } from "react-router-dom";
import {
  MaterialReactTable,
  MRT_ColumnDef,
  MRT_EditActionButtons,
} from "material-react-table";
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
import { UsuarioSistema } from "../../usuarios/models/usuarioSistema.model";
import { obtenerUsuarios } from "../../usuarios/services/usuarioService";

export default function ClientesCrud() {
  // Hook de navegación
  const navigate = useNavigate();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [ejecutivos, setEjecutivos] = useState<UsuarioSistema[]>([]);

  // Carga clientes
  const fetchClientes = async () => {
    setLoading(true);
    const data = await obtenerClientes();
    setClientes(data);
    setLoading(false);
  };

  // Carga ejecutivos
  const fetchEjecutivos = async () => {
    const todos = await obtenerUsuarios();
    setEjecutivos(todos.filter((u) => u.rol === "ejecutivo"));
  };

  useEffect(() => {
    fetchClientes();
    fetchEjecutivos();
  }, []);

  // Columnas de la tabla
  const columns = useMemo<MRT_ColumnDef<Cliente>[]>(
    () => [
      { accessorKey: "nombre", header: "Nombre" },
      { accessorKey: "correo", header: "Correo" },
      {
        accessorKey: "tipo",
        header: "Tipo",
        editVariant: "select",
        editSelectOptions: ["natural", "jurídica"],
      },
      { accessorKey: "telefono", header: "Teléfono" },
      { accessorKey: "direccion", header: "Dirección" },
      {
        accessorKey: "ejecutivoEmail",
        header: "Ejecutivo",
        editVariant: "select",
        editSelectOptions: ejecutivos.map((e) => e.email),
        Cell: ({ cell }) => <span>{cell.getValue<string>()}</span>,
      },
      { accessorKey: "banco", header: "Banco" },
      { accessorKey: "numeroCuenta", header: "Número de Cuenta" },
      {
        accessorKey: "tipoCuenta",
        header: "Tipo de Cuenta",
        editVariant: "select",
        editSelectOptions: ["ahorros", "corriente", "convenio"],
      },
    ],
    [ejecutivos]
  );

  return (
    <MaterialReactTable<Cliente>
      columns={columns}
      data={clientes}
      getRowId={(row) => row.id!}
      enableEditing
      editDisplayMode="modal"
      createDisplayMode="modal"
      state={{ isLoading: loading }}
      onCreatingRowSave={async ({ values, table }) => {
        await crearCliente(values as Cliente);
        table.setCreatingRow(null);
        fetchClientes();
      }}
      onEditingRowSave={async ({ values, row, table }) => {
        try {
          const id = row.original.id!;
          await actualizarCliente({ ...values, id } as Cliente);
          table.setEditingRow(null);
          fetchClientes();
        } catch (error: any) {
          alert(error.message);
        }
      }}
      renderRowActions={({ row, table }) => (
        <Box sx={{ display: "flex", gap: "0.5rem" }}>
          {/* Botón Ver Inmuebles */}
          <Tooltip title="Ver inmuebles">
            <IconButton
              size="small"
              onClick={() => navigate(`/inmuebles/${row.original.id}`)}
            >
              <VisibilityIcon />
            </IconButton>
          </Tooltip>
          {/* Botón Editar */}
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => table.setEditingRow(row)}>
              <EditIcon />
            </IconButton>
          </Tooltip>
          {/* Botón Eliminar */}
          <Tooltip title="Eliminar">
            <IconButton
              size="small"
              color="error"
              onClick={async () => {
                await eliminarCliente(row.original.id!);
                fetchClientes();
              }}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
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
