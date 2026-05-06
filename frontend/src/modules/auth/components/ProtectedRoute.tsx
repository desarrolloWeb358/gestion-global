import { Navigate } from "react-router-dom";
import { JSX } from "react";
import { ShieldOff } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase";
import { useUsuarioActual } from "../hooks/useUsuarioActual";

function UsuarioInactivoScreen() {
  const handleSignOut = async () => {
    await signOut(auth);
    window.location.href = "/signin";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8">

        {/* Ícono */}
        <div className="flex justify-center">
          <div className="p-6 rounded-full bg-red-100 border-4 border-red-200 shadow-inner">
            <ShieldOff className="h-16 w-16 text-red-600" strokeWidth={1.5} />
          </div>
        </div>

        {/* Título */}
        <div className="space-y-3">
          <h1 className="text-4xl font-extrabold text-red-700 tracking-tight">
            Usuario Inactivo
          </h1>
          <div className="w-20 h-1.5 bg-red-400 mx-auto rounded-full" />
        </div>

        {/* Tarjeta de mensaje */}
        <div className="bg-white rounded-2xl border border-red-100 shadow-xl p-8 space-y-4">
          <p className="text-gray-700 text-lg leading-relaxed">
            Tu cuenta ha sido{" "}
            <span className="font-semibold text-red-600">desactivada</span>{" "}
            y no tienes acceso al sistema.
          </p>
          <div className="border-t border-red-50 pt-4">
            <p className="text-gray-500 text-base">
              Para recuperar el acceso comunícate con el{" "}
              <span className="font-semibold text-gray-700">
                administrador del sistema
              </span>
              .
            </p>
          </div>
        </div>

        {/* Botón cerrar sesión */}
        <button
          onClick={handleSignOut}
          className="w-full py-3 px-6 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold text-base transition-colors shadow-md hover:shadow-lg"
        >
          Cerrar sesión
        </button>

        {/* Footer */}
        <p className="text-xs text-gray-400 tracking-wide">
          Gestión Global — ACG SAS
        </p>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { usuario, usuarioSistema, loading } = useUsuarioActual();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-100 border-t-red-600" />
          <p className="text-sm text-gray-400">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/signin" replace />;
  }

  if (usuarioSistema?.activo === false) {
    return <UsuarioInactivoScreen />;
  }

  return children;
}
