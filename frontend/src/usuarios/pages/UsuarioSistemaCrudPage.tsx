import { useEffect, useState } from "react";
import {
  getUsuariosSistema,
  addUsuarioSistema,
  deleteUsuarioSistema,
} from "../services/usuarioSistemaService";
import { UsuarioSistema } from "../models/usuarioSistema.model";
import UsuarioSistemaForm from "../components/UsuarioSistemaForm";
import { Typography, IconButton, List, ListItem, ListItemText } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

const UsuarioSistemaCrudPage = () => {
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);

  const cargarUsuarios = async () => {
    const data = await getUsuariosSistema();
    setUsuarios(data);
  };

  const manejarCrear = async (nuevo: Omit<UsuarioSistema, "uid">) => {
    await addUsuarioSistema(nuevo);
    cargarUsuarios();
  };

  const manejarEliminar = async (uid: string) => {
    await deleteUsuarioSistema(uid);
    cargarUsuarios();
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  return (
    <div>
      <Typography variant="h5">Gestión de Usuarios del Sistema</Typography>
      <UsuarioSistemaForm onSubmit={manejarCrear} />

      <List>
        {usuarios.map((u) => (
          <ListItem key={u.uid}
            secondaryAction={
              <IconButton edge="end" onClick={() => manejarEliminar(u.uid)}>
                <DeleteIcon />
              </IconButton>
            }
          >
            <ListItemText
              primary={`${u.nombre || u.email} (${u.rol})`}
              secondary={`Activo: ${u.activo ? "Sí" : "No"}`}
            />
          </ListItem>
        ))}
      </List>
    </div>
  );
};

export default UsuarioSistemaCrudPage;