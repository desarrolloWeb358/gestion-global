// src/modules/dashboard/pages/DeudorDashboardPage.tsx
import * as React from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/firebase";
import { useNavigate } from "react-router-dom";
import { getUsuarioByUid } from "@/modules/usuarios/services/usuarioService";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { Typography } from "@/shared/design-system/components/Typography";
import { ROLE_HOME } from "@/shared/constants/acl";

export default function DeudorDashboardPage() {
  const [loading, setLoading] = React.useState(true);
  const [firebaseUser, setFirebaseUser] = React.useState<User | null>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/signin");
        return;
      }
      setFirebaseUser(user);
    });

    return () => unsub();
  }, [navigate]);

  React.useEffect(() => {
    const run = async () => {
      if (!firebaseUser) return;

      try {
        const usuarioSistema: UsuarioSistema | null = await getUsuarioByUid(firebaseUser.uid);

        if (!usuarioSistema) {
          navigate("/signin");
          return;
        }

        // Si NO es deudor, redirigir a su home correspondiente según rol
        const roles = usuarioSistema.roles || [usuarioSistema.roles[0]];
        const isDeudor = roles.includes("deudor");

        if (!isDeudor) {
          // Obtener la ruta home según el rol principal del usuario
          const homeRoute = ROLE_HOME[roles[0] as keyof typeof ROLE_HOME] || "/home";
          navigate(homeRoute, { replace: true });
          return;
        }

        // Validar que el deudor tenga los IDs asociados
        const clienteId = usuarioSistema.clienteIdAsociado;
        const deudorId = usuarioSistema.deudorIdAsociado;

        if (!clienteId || !deudorId) {
          console.error("Deudor sin clienteIdAsociado o deudorIdAsociado");
          navigate("/signin");
          return;
        }

        // Redirección al detalle del deudor
        navigate(`/clientes/${clienteId}/deudores/${deudorId}`, { replace: true });
      } catch (error) {
        console.error("Error al cargar información del usuario:", error);
        navigate("/signin");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [firebaseUser, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
          <Typography variant="body" className="text-muted">
            Cargando información del deudor...
          </Typography>
        </div>
      </div>
    );
  }

  // Nunca se ve porque navegamos con replace
  return null;
}