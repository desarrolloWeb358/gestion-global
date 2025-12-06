// src/modules/auth/pages/RedirectByRol.tsx
import { Navigate, useLocation } from "react-router-dom";
import { useUsuarioActual } from "../hooks/useUsuarioActual";
import { ROLE_HOME, ROL_PRIORITY, type Rol } from "@/shared/constants/acl";

export default function RedirectByRol() {
  const { usuario, usuarioSistema, roles, loading } = useUsuarioActual();
  const location = useLocation();

  if (loading) return null;

  // No hay sesión → login
  if (!usuario) return <Navigate to="/signin" replace />;

  // Roles del usuario (de hook o del doc /usuarios/{uid})
  const userRoles: Rol[] =
    (roles && roles.length ? roles : usuarioSistema?.roles) ?? [];

  // Escoger rol principal según prioridad
  const mainRole: Rol =
    (ROL_PRIORITY.find((r) => userRoles.includes(r)) ??
      userRoles[0] ??
      "cliente");

  let target: string;

  // 🔹 Caso especial: DEUDOR → ir a su ficha, no al dashboard
  if (
    mainRole === "deudor" &&
    usuarioSistema?.clienteIdAsociado &&
    usuarioSistema?.deudorIdAsociado
  ) {
    target = `/clientes/${usuarioSistema.clienteIdAsociado}/deudores/${usuarioSistema.deudorIdAsociado}`;
  } else {
    // resto de roles usan el mapa normal
    target = ROLE_HOME[mainRole];
  }

  // ❗ Muy importante: si ya estoy en target, no redirijo → evita bucle
  if (location.pathname === target) {
    return null;
  }

  return <Navigate to={target} replace />;
}
