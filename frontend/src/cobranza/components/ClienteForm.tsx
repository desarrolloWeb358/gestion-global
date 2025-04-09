import { useState } from "react";
import { TextField, MenuItem } from "@mui/material";
import ButtonPrimary from "../../common/ui/ButtonPrimary";
import { Cliente } from "../models/cliente.model";


interface Props {
  onSubmit: (data: Omit<Cliente, "id">) => void;
}

const ClienteForm = ({ onSubmit }: Props) => {
  const [form, setForm] = useState<Omit<Cliente, "id">>({
    nombre: "",
    correo: "",
    tipo: "natural",
    telefono: "",
    direccion: "",
    fecha_creacion: new Date().toISOString(),
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = () => {
    onSubmit(form);
    setForm({ ...form, nombre: "", correo: "", telefono: "", direccion: "" });
  };

  return (
    <div>
      <TextField label="Nombre" name="nombre" value={form.nombre} onChange={handleChange} fullWidth margin="normal" />
      <TextField label="Correo" name="correo" value={form.correo} onChange={handleChange} fullWidth margin="normal" />
      <TextField
        select
        label="Tipo"
        name="tipo"
        value={form.tipo}
        onChange={handleChange}
        fullWidth
        margin="normal"
      >
        <MenuItem value="natural">Natural</MenuItem>
        <MenuItem value="jurídica">Jurídica</MenuItem>
      </TextField>
      <TextField label="Teléfono" name="telefono" value={form.telefono} onChange={handleChange} fullWidth margin="normal" />
      <TextField label="Dirección" name="direccion" value={form.direccion} onChange={handleChange} fullWidth margin="normal" />
      <ButtonPrimary onClick={handleSubmit}>Guardar Cliente</ButtonPrimary>
    </div>
  );
};

export default ClienteForm;
