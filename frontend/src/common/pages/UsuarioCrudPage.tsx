import { useEffect, useState } from "react";
import { Usuario } from "../models/usuario.model";
import { cerrarSesion } from "../auth/services/authService";
import { useNavigate } from "react-router-dom";
import ButtonPrimary from "../ui/ButtonPrimary";

import {
  getUsuarios,
  addUsuario,
  deleteUsuario
} from "../services/usuarioService";
import UsuarioForm from "../components/UsuarioForm";







const UsuarioCrudPage = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const navigate = useNavigate();

  const handleLogout = async () => {
    await cerrarSesion();
    navigate("/login");
  };

  const cargarUsuarios = async () => {
    const data = await getUsuarios();
    setUsuarios(data);
  };

  const manejarCrear = async (nuevo: Omit<Usuario, "id">) => {
    await addUsuario(nuevo);
    cargarUsuarios();
  };

  const manejarEliminar = async (id: string) => {
    await deleteUsuario(id);
    cargarUsuarios();
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  return (
    <div>
    <ButtonPrimary onClick={handleLogout}>Cerrar sesión</ButtonPrimary>
    <h2>Gestión de Usuarios</h2>
    <UsuarioForm onSubmit={manejarCrear} />
    <ul>
      {usuarios.map((u) => (
        <li key={u.id}>
          <strong>{u.nombre}</strong> | Edad: {u.edad} | Documento: {u.documento}
          <button onClick={() => manejarEliminar(u.id!)}>🗑️ Eliminar</button>
        </li>
      ))}
    </ul>
  </div>
  );
};

export default UsuarioCrudPage;
