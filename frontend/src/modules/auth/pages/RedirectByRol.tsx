import { Navigate } from "react-router-dom";
import { useUsuarioActual } from "../hooks/useUsuarioActual";
import { roleHome } from "@/shared/lib/rbac";

export default function RedirectByRol() {
  const { usuario, roles, loading } = useUsuarioActual();
  if (loading) return null;
  if (!usuario) return <Navigate to="/signin" replace />;
  return <Navigate to={roleHome(roles)} replace />;

}
