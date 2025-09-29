// src/modules/dashboard/pages/ClienteDashboardPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";

import { Button } from "@/shared/ui/button";
import { Cliente } from "@/modules/clientes/models/cliente.model";
import { ClienteInfoSummaryCard } from "@/modules/clientes/components/ClienteInfoSummaryCard";

import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";

// 👇 importa el servicio para leer el usuario
import { getUsuarioByUid } from "@/modules/usuarios/services/usuarioService";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";

export default function ClienteDashboardPage() {
  const navigate = useNavigate();

  // sesión/permisos
  const { usuario, loading: userLoading } = useUsuarioActual();
  const { can, loading: aclLoading } = useAcl();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [usuarioCliente, setUsuarioCliente] = useState<UsuarioSistema | null>(null);

  const [loadingCliente, setLoadingCliente] = useState(true);
  const [loadingUsuario, setLoadingUsuario] = useState(true);

  // 1) Cargar datos del cliente usando el UID como id del doc
  useEffect(() => {
    const run = async () => {
      if (userLoading || !usuario?.uid) return;
      setLoadingCliente(true);
      try {
        const ref = doc(db, "clientes", usuario.uid);
        const snap = await getDoc(ref);
        setCliente(snap.exists() ? ({ id: snap.id, ...snap.data() } as Cliente) : null);
      } finally {
        setLoadingCliente(false);
      }
    };
    run();
  }, [usuario?.uid, userLoading]);

  // 2) Cargar UsuarioSistema (email, teléfono, documento)
  useEffect(() => {
    const run = async () => {
      if (userLoading || !usuario?.uid) return;
      setLoadingUsuario(true);
      try {
        const u = await getUsuarioByUid(usuario.uid);
        setUsuarioCliente(u);
      } finally {
        setLoadingUsuario(false);
      }
    };
    run();
  }, [usuario?.uid, userLoading]);

  // Estados de carga / sin acceso
  if (userLoading || aclLoading || loadingCliente || loadingUsuario) {
    return <div className="p-6 text-muted-foreground">Cargando información del cliente…</div>;
  }
  if (!usuario) {
    return <div className="p-6 text-red-600">No hay sesión activa.</div>;
  }
  if (!cliente) {
    return <div className="p-6 text-red-600">No encontramos tu información de cliente.</div>;
  }

  const canViewDeudores = can(PERMS.Deudores_Read);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Hola, {cliente.nombre}</h1>

      {/* 👉 ahora sí pasamos usuarioCliente al card */}
      <ClienteInfoSummaryCard cliente={cliente} usuarioCliente={usuarioCliente} />

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
  