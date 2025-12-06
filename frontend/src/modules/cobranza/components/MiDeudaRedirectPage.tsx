// src/modules/deudores/pages/MiDeudaRedirectPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { Typography } from "@/shared/design-system/components/Typography";

export default function MiDeudaRedirectPage() {
  const navigate = useNavigate();
  const [mensaje, setMensaje] = useState("Cargando tu información...");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/signin", { replace: true });
        return;
      }

      try {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        if (!snap.exists()) {
          setMensaje("No se encontró tu usuario en el sistema.");
          return;
        }

        const u = snap.data() as UsuarioSistema;

        // 1) Validamos que sea deudor
        if (!u.roles?.includes("deudor")) {
          setMensaje("Tu usuario no es deudor. Redirigiendo a inicio...");
          navigate("/home", { replace: true });
          return;
        }

        // 2) Validamos que tenga cliente/deudor asociados
        if (!u.clienteIdAsociado || !u.deudorIdAsociado) {
          setMensaje(
            "Tu usuario deudor no está asociado correctamente. Contacta a la administración."
          );
          return;
        }

        // 3) Redirigir a SU ficha de deudor
        navigate(
          `/clientes/${u.clienteIdAsociado}/deudores/${u.deudorIdAsociado}`,
          { replace: true }
        );
      } catch (e) {
        console.error(e);
        setMensaje("Error cargando tu información. Intenta nuevamente.");
      }
    });

    return () => unsub();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <Typography variant="body" className="text-muted">
        {mensaje}
      </Typography>
    </div>
  );
}
