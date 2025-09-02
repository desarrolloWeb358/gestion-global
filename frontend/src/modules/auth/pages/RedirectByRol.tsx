import { Navigate } from "react-router-dom";
import { useUsuarioActual } from "../hooks/useUsuarioActual";

export default function RedirectByRol() {
  const { usuario, loading } = useUsuarioActual();

  if (loading) return <div>Cargando...</div>;

  if (!usuario) return <Navigate to="/signin" />;

  // redirigir todos a usuarios table sin importar el rol
  return <Navigate to="/clientes-tables" />;

    
  // Lógica de redirección
      /*  
      if (Array.isArray(usuario.roles) && usuario.roles.length === 1) {
        const rol = usuario.roles[0];
        if (rol === "admin") navigate("/admin/dashboard");
        else if (rol === "cliente") navigate("/admin/dashboard");
        else if (rol === "abogado") navigate("/admin/dashboard");
        else if (rol === "deudor") navigate("/admin/dashboard");
        else if (rol === "ejecutivo") navigate("/admin/dashboard");
        else navigate("/home"); // fallback
      } else {
        navigate("/home"); // Si tiene múltiples roles, redirige a home
      }
        */

}
