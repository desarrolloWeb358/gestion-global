import { useState } from "react";
import { Usuario } from "../models/usuario.model";

interface Props {
  onSubmit: (usuario: Omit<Usuario, "id">) => void;
}

const UsuarioForm = ({ onSubmit }: Props) => {
  const [nombre, setNombre] = useState("");
  const [edad, setEdad] = useState(0);
  const [documento, setDocumento] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ nombre, edad, documento });
    setNombre("");
    setEdad(0);
    setDocumento("");
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        placeholder="Nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />
      <input
        type="number"
        placeholder="Edad"
        value={edad}
        onChange={(e) => setEdad(Number(e.target.value))}
      />
      <input
        placeholder="Documento"
        value={documento}
        onChange={(e) => setDocumento(e.target.value)}
      />
      <button type="submit">Guardar Usuario</button>
    </form>
  );
};

export default UsuarioForm;
