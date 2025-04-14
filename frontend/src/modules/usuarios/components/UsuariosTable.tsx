import React, { useEffect, useMemo, useState } from "react";
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
  Switch,
  TextField
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { UsuarioSistema } from "../models/usuarioSistema.model";
import {
  obtenerUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
} from "../services/usuarioService";

export default function UsuariosCrud() {
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState(""); // solo para creación

  const fetchUsuarios = async () => {
    setLoading(true);
    const data = await obtenerUsuarios();
    setUsuarios(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const columns = useMemo<MRT_ColumnDef<UsuarioSistema>[]>(() => [
    { accessorKey: "email", header: "Email" },
    { accessorKey: "nombre", header: "Nombre" },
    { accessorKey: "rol", header: "Rol", editVariant: "select", editSelectOptions: ["admin", "ejecutivo", "cliente", "inmueble"] },
    { accessorKey: "asociadoA", header: "Asociado A" },
    {
      accessorKey: "activo",
      header: "Activo",
      Cell: ({ cell }) => (
        <Switch checked={cell.getValue() as boolean} disabled />
      ),
      muiEditTextFieldProps: { type: "checkbox" },
    },
    { accessorKey: "fecha_registro", header: "Fecha de Registro", enableEditing: false },
  ], []);

  return (
    <MaterialReactTable
      columns={columns}
      data={usuarios}
      getRowId={(row) => row.uid}
      enableEditing
      editDisplayMode="modal"
      createDisplayMode="modal"
      state={{ isLoading: loading }}
      onCreatingRowSave={async ({ values, table }) => {
        try {
          if (!password) throw new Error("La contraseña es obligatoria");
          await crearUsuario({ ...values, password }); // usa la contraseña
          setPassword(""); // limpia la contraseña
          table.setCreatingRow(null);
          fetchUsuarios();
        } catch (error: any) {
          alert(error.message);
        }
      }}
      onEditingRowSave={async ({ values, table }) => {
        await actualizarUsuario(values);
        table.setEditingRow(null);
        fetchUsuarios();
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
              await eliminarUsuario(row.original.uid);
              fetchUsuarios();
            }}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      renderTopToolbarCustomActions={({ table }) => (
        <Button onClick={() => table.setCreatingRow(true)} variant="contained">
          Crear Usuario
        </Button>
      )}
      renderCreateRowDialogContent={({ internalEditComponents, table, row }) => (
        <>
          <DialogTitle>Crear Usuario</DialogTitle>
          <DialogContent sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {internalEditComponents}
            <TextField
              label="Contraseña"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <MRT_EditActionButtons table={table} row={row} />
          </DialogActions>
        </>
      )}
      renderEditRowDialogContent={({ internalEditComponents, table, row }) => (
        <>
          <DialogTitle>Editar Usuario</DialogTitle>
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
