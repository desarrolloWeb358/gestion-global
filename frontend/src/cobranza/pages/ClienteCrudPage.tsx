import { useEffect, useState } from "react";
import {
  getClientes,
  addCliente,
  deleteCliente,
} from "../services/clienteService";
import { Cliente } from "../models/cliente.model";
import ClienteForm from "../components/ClienteForm";
import { Typography, IconButton, List, ListItem, ListItemText } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

const ClienteCrudPage = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const cargarClientes = async () => {
    const data = await getClientes();
    setClientes(data);
  };

  const manejarCrear = async (nuevo: Omit<Cliente, "id">) => {
    await addCliente(nuevo);
    cargarClientes();
  };

  const manejarEliminar = async (id: string) => {
    await deleteCliente(id);
    cargarClientes();
  };

  useEffect(() => {
    cargarClientes();
  }, []);

  return (
    <div>
      <Typography variant="h5">Gestión de Clientes (Conjuntos Residenciales)</Typography>
      <ClienteForm onSubmit={manejarCrear} />

      <List>
        {clientes.map((c) => (
          <ListItem key={c.id}
            secondaryAction={
              <IconButton edge="end" onClick={() => manejarEliminar(c.id!)}>
                <DeleteIcon />
              </IconButton>
            }
          >
            <ListItemText
              primary={c.nombre}
              secondary={`Tipo: ${c.tipo} • Correo: ${c.correo}`}
            />
          </ListItem>
        ))}
      </List>
    </div>
  );
};

export default ClienteCrudPage;
