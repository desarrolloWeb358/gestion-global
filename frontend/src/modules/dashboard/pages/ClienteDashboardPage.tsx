// src/modules/dashboard/pages/ClienteDashboardPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";

import { Button } from "@/shared/ui/button";
import { Cliente } from "@/modules/clientes/models/cliente.model";
import { ClienteInfoSummaryCard } from "@/modules/clientes/components/ClienteInfoSummaryCard";

// 🔐 sesión/permisos
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";

export default function ClienteDashboardPage() {
  const navigate = useNavigate();

  // 🔐 user actual (uid y roles)
  const { usuario, roles, loading: userLoading } = useUsuarioActual();
  const { can, loading: aclLoading } = useAcl();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar datos del cliente usando el UID como id del doc
  useEffect(() => {
    const run = async () => {
      if (userLoading || !usuario?.uid) return;
      setLoading(true);
      try {
        const ref = doc(db, "clientes", usuario.uid);
        const snap = await getDoc(ref);
        setCliente(snap.exists() ? ({ id: snap.id, ...snap.data() } as Cliente) : null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [usuario?.uid, userLoading]);

  // Estados de carga / sin acceso
  if (userLoading || aclLoading || loading) {
    return <div className="p-6 text-muted-foreground">Cargando información del cliente…</div>;
  }
  if (!usuario) {
    return <div className="p-6 text-red-600">No hay sesión activa.</div>;
  }
  if (!cliente) {
    return <div className="p-6 text-red-600">No encontramos tu información de cliente.</div>;
  }

  // Permiso para ver deudores (rol cliente lo tiene en tu ROLE_PERMISSIONS)
  const canViewDeudores = can(PERMS.Deudores_Read);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Hola, {cliente.nombre}</h1>

      {/* Tarjeta con la info del cliente (ya la tienes lista) */}
     <ClienteInfoSummaryCard cliente={cliente} />

      {/* Botonera mínima para cliente */}
      <div className="mt-4">
        <Button
          disabled={!canViewDeudores}
          onClick={() => navigate(`/deudores/${cliente.id}`)}
        >
          Ver Deudores
        </Button>
      </div>
    </div>
  );
}
