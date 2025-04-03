import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getInmuebles,
  addInmueble,
  deleteInmueble,
} from "../services/inmuebleService";
import { Inmueble } from "../models/inmueble.model";
import InmuebleForm from "../components/InmuebleForm";
import { Typography, IconButton, List, ListItem, ListItemText } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

const InmuebleCrudPage = () => {
  const { clienteId } = useParams<{ clienteId: string }>();
  const [inmuebles, setInmuebles] = useState<Inmueble[]>([]);

  const cargarInmuebles = async () => {
    if (!clienteId) return;
    const data = await getInmuebles(clienteId);
    setInmuebles(data);
  };

  const manejarCrear = async (nuevo: Omit<Inmueble, "id">) => {
    if (!clienteId) return;
    await addInmueble(clienteId, nuevo);
    cargarInmuebles();
  };

  const manejarEliminar = async (id: string) => {
    if (!clienteId) return;
    await deleteInmueble(clienteId, id);
    cargarInmuebles();
  };

  useEffect(() => {
    cargarInmuebles();
  }, [clienteId]);

  return (
    <div>
      <Typography variant="h5">Inmuebles del Cliente</Typography>
      <InmuebleForm onSubmit={manejarCrear} />

      <List>
        {inmuebles.map((i) => (
          <ListItem key={i.id}
            secondaryAction={
              <IconButton edge="end" onClick={() => manejarEliminar(i.id!)}>
                <DeleteIcon />
              </IconButton>
            }
          >
            <ListItemText
              primary={i.responsable}
              secondary={`Tipificación: ${i.tipificacion} • Deuda: $${i.deuda_total}`}
            />
          </ListItem>
        ))}
      </List>
    </div>
  );
};

export default InmuebleCrudPage;
