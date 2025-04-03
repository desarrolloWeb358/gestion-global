import { useState } from "react";
import { TextField, MenuItem } from "@mui/material";
import ButtonPrimary from "../../common/ui/ButtonPrimary";
import { UsuarioSistema } from "../models/usuarioSistema.model";

interface Props {
  onSubmit: (data: Omit<UsuarioSistema, "uid">) => void;
}

const UsuarioSistemaForm = ({ onSubmit }: Props) => {
  const [form, setForm] = useState<Omit<UsuarioSistema, "uid">>({
    email: "",
    rol: "admin",
    nombre: "",
    activo: true,
    fecha_registro: new Date().toISOString(),
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = () => {
    onSubmit(form);
    setForm({ ...form, email: "", nombre: "" });
  };

  return (
    <div>
      <TextField
        label="Email"
        name="email"
        value={form.email}
        onChange={handleChange}
        fullWidth
        margin="normal"
      />
      <TextField
        label="Nombre"
        name="nombre"
        value={form.nombre}
        onChange={handleChange}
        fullWidth
        margin="normal"
      />
      <TextField
        select
        label="Rol"
        name="rol"
        value={form.rol}
        onChange={handleChange}
        fullWidth
        margin="normal"
      >
        <MenuItem value="admin">Admin</MenuItem>
        <MenuItem value="cliente">Cliente</MenuItem>
        <MenuItem value="inmueble">Inmueble</MenuItem>
      </TextField>
      <ButtonPrimary onClick={handleSubmit}>Guardar Usuario</ButtonPrimary>
    </div>
  );
};

export default UsuarioSistemaForm;