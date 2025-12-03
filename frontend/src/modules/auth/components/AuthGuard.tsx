// src/modules/auth/components/AuthGuard.tsx (o donde esté)
import { useEffect, useState, ReactNode } from "react";
import type { JSX } from "react";
import { auth } from "@/firebase"; // mejor con alias
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";

interface AuthGuardProps {
  children: ReactNode;
}

const AuthGuard = ({ children }: AuthGuardProps): JSX.Element | null => {
  const [cargando, setCargando] = useState(true);
  const [usuarioAutenticado, setUsuarioAutenticado] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUsuarioAutenticado(true);
      } else {
        navigate("/signin"); // antes estaba "/login"
      }
      setCargando(false);
    });

    return () => unsub();
  }, [navigate]);

  if (cargando) return <p>Cargando...</p>;

  return usuarioAutenticado ? <>{children}</> : null;
};

export default AuthGuard;
