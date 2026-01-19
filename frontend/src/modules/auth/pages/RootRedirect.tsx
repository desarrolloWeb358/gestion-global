import { Navigate } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthContext";

export default function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) return null; // o un loader

  // ✅ Si hay sesión -> a tu redirección por rol
  if (user) return <Navigate to="/home" replace />;

  // ❌ Si no hay sesión -> login
  return <Navigate to="/signin" replace />;
}
