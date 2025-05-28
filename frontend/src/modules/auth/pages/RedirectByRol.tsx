import { Navigate } from "react-router-dom";
import { useUsuarioActual } from "../hooks/useUsuarioActual";

export default function RedirectByRol() {
  const { usuario, loading } = useUsuarioActual();

  if (loading) return <div>Cargando...</div>;

  if (!usuario) return <Navigate to="/signin" />;

  switch (usuario.rol) {
    case "admin":
      return <Navigate to="/admin/dashboard" />;
    case "ejecutivo":
      return <Navigate to="/ejecutivo/dashboard" />;
    case "cliente":
      return <Navigate to="/cliente/dashboard" />;
    case "inmueble":
      return <Navigate to="/inmueble/dashboard" />;
    default:
      return <Navigate to="/signin" />;
  }
}
