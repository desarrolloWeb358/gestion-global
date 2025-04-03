import { useState } from "react";
import { TextField } from "@mui/material";
import ButtonPrimary from "../../common/ui/ButtonPrimary";
import { Inmueble } from "../models/inmueble.model";

interface Props {
  onSubmit: (data: Omit<Inmueble, "id">) => void;
}

const InmuebleForm = ({ onSubmit }: Props) => {
  const [form, setForm] = useState<Omit<Inmueble, "id">>({
    responsable: "",
    tipificacion: "",
    deuda_total: 0,
    correos: [],
    telefonos: [],
    recaudos: {},
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = () => {
    onSubmit(form);
    setForm({ ...form, responsable: "", tipificacion: "", deuda_total: 0 });
  };

  return (
    <div>
      <TextField label="Responsable" name="responsable" value={form.responsable} onChange={handleChange} fullWidth margin="normal" />
      <TextField label="Tipificación" name="tipificacion" value={form.tipificacion} onChange={handleChange} fullWidth margin="normal" />
      <TextField label="Deuda Total" name="deuda_total" value={form.deuda_total} onChange={handleChange} fullWidth margin="normal" type="number" />
      <ButtonPrimary onClick={handleSubmit}>Guardar Inmueble</ButtonPrimary>
    </div>
  );
};

export default InmuebleForm;
