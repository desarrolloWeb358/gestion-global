import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { MaterialReactTable, MRT_ColumnDef, MRT_EditActionButtons } from "material-react-table";
import { Box, Button, DialogActions, DialogContent, DialogTitle, IconButton, Tooltip } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { Inmueble } from "../models/inmueble.model";
import {
  obtenerInmueblesPorCliente,
  crearInmueble,
  actualizarInmueble,
  eliminarInmueble,
} from "../services/inmuebleService";

export default function InmueblesPage() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const [inmuebles, setInmuebles] = useState<Inmueble[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchInmuebles = async () => {
    if (!clienteId) return;
    setLoading(true);
    const data = await obtenerInmueblesPorCliente(clienteId);
    setInmuebles(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchInmuebles();
  }, [clienteId]);

  const columns = useMemo<MRT_ColumnDef<Inmueble>[]>(
    () => [
      { accessorKey: "torre", header: "Torre" },
      { accessorKey: "apartamento", header: "Apartamento" },
      { accessorKey: "casa", header: "Casa" },
      { accessorKey: "responsable", header: "Responsable" },
      { accessorKey: "tipificacion", header: "Tipificación" },
      {
        accessorKey: "deuda_total",
        header: "Deuda Total",
        Cell: ({ cell }) => `$${cell.getValue<number>()}`,
      },
      {
        accessorKey: "correos",
        header: "Correos",
        Cell: ({ cell }) => (cell.getValue<string[]>() || []).join(", "),
      },
      {
        accessorKey: "telefonos",
        header: "Teléfonos",
        Cell: ({ cell }) => (cell.getValue<string[]>() || []).join(", "),
      },
      // Para mostrar acuerdo_pago o recaudos, podrías usar una columna expandible o un modal adicional
    ],
    []
  );

  return (
    <MaterialReactTable<Inmueble>
      columns={columns}
      data={inmuebles}
      getRowId={(row) => row.id!}
      enableEditing
      editDisplayMode="modal"
      createDisplayMode="modal"
      state={{ isLoading: loading }}
      onCreatingRowSave={async ({ values, table }) => {
        // en InmueblesPage.tsx
        await crearInmueble({ clienteId: clienteId!, ...values });

        table.setCreatingRow(null);
        fetchInmuebles();
      }}
      onEditingRowSave={async ({ values, row, table }) => {
        try {
    // Primero spread de los valores editados...
    // y luego asignas el id para que prevalezca
    const updated: Inmueble = {
      ...values,
      id: row.original.id!,
    } as Inmueble;
        await actualizarInmueble(updated);
    table.setEditingRow(null);
    fetchInmuebles();
  } catch (error: any) {
    alert(error.message);
  }
}}
      renderRowActions={({ row, table }) => (
        <Box sx={{ display: "flex", gap: "0.5rem" }}>
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => table.setEditingRow(row)}>
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar">
            <IconButton
              size="small"
              color="error"
              onClick={async () => {
                await eliminarInmueble(row.original.id!);
                fetchInmuebles();
              }}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      renderTopToolbarCustomActions={({ table }) => (
        <Button onClick={() => table.setCreatingRow(true)}>Crear Inmueble</Button>
      )}
      renderCreateRowDialogContent={({ internalEditComponents, table, row }) => (
        <>
          <DialogTitle>Crear Inmueble</DialogTitle>
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
          <DialogTitle>Editar Inmueble</DialogTitle>
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
