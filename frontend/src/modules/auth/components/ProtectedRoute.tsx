import { Navigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthContext";
import { JSX } from "react";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  // Mientras Firebase valida la sesión
  if (loading) {
    return <div className="p-6">Cargando sesión...</div>;
  }

  // No logueado → login
  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  // Logueado → deja pasar
  return children;
}
