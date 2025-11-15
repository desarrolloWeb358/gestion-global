// src/modules/dashboard/pages/ClienteDashboardPage.tsx
import { Navigate } from "react-router-dom";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";

export default function ClienteDashboardPage() {
  const { usuario, loading: userLoading } = useUsuarioActual();
  const { can, loading: aclLoading } = useAcl();

  const canViewCliente = can(PERMS.Clientes_Read);

  if (userLoading || aclLoading) {
    return (
      <div className="p-6 text-muted-foreground">
        Cargando información del cliente…
      </div>
    );
  }

  if (!usuario) {
    return <div className="p-6 text-red-600">No hay sesión activa.</div>;
  }

  if (!canViewCliente) {
    return (
      <div className="p-6 text-red-600">
        No tienes permisos para ver la información del cliente.
      </div>
    );
  }

  // 👉 Aquí está la magia: redirigir al detalle del cliente usando su UID
  return <Navigate to={`/clientes/${usuario.uid}`} replace />;
}
