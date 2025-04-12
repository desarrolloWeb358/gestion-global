import { useEffect, useState, ReactNode } from "react";
import type { JSX } from "react"; 
import { auth } from "../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import React from "react";
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
        navigate("/login");
      }
      setCargando(false);
    });

    return () => unsub();
  }, []);

  if (cargando) return <p>Cargando...</p>;

  return usuarioAutenticado ? <>{children}</> : null;
};

export default AuthGuard;
