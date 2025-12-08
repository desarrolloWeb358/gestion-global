// src/modules/dashboard/pages/DeudorDashboardPage.tsx
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/firebase";
import { useNavigate } from "react-router-dom";
import { getUsuarioByUid } from "@/modules/usuarios/services/usuarioService";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";

export default function DeudorDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/signin");
        return;
      }
      setFirebaseUser(user);
    });

    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    const run = async () => {
      if (!firebaseUser) return;

      const usuarioSistema: UsuarioSistema | null = await getUsuarioByUid(firebaseUser.uid);

      if (!usuarioSistema) {
        navigate("/signin");
        return;
      }

      /*
      // Si NO es deudor, que se vaya a su home normal
      if (usuarioSistema.rol !== "deudor") {
        // aquí podrías usar tu lógica de ROLE_HOME si quieres
        navigate("/home");
        return;
      }
      */

      const clienteId = usuarioSistema.clienteIdAsociado;
      const deudorId = usuarioSistema.deudorIdAsociado;

      if (!clienteId || !deudorId) {
        console.error("Deudor sin clienteIdAsociado o deudorIdAsociado");
        navigate("/signin");
        return;
      }

      // 👉 Redirección al detalle ÚNICO de este deudor
      navigate(`/clientes/${clienteId}/deudores/${deudorId}`, { replace: true });
      setLoading(false);
    };

    run();
  }, [firebaseUser, navigate]);

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">
          Cargando información del deudor...
        </p>
      </div>
    );
  }

  // Realmente nunca se ve, porque navegamos con replace
  return null;
}
