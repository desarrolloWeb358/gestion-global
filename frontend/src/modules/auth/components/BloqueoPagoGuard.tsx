import { JSX, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase";
import { useUsuarioActual } from "../hooks/useUsuarioActual";
import type { Rol } from "@/shared/constants/acl";

// Roles del equipo: si el usuario tiene alguno, el bloqueo comercial no aplica.
const ROLES_INTERNOS: Rol[] = [
  "admin",
  "supervisor",
  "adminFranquicia",
  "ejecutivo",
  "ejecutivoAdmin",
  "dependiente",
  "abogado",
];

/**
 * Cierra el portal del cliente cuando su conjunto está inhabilitado por no pago
 * (`clientes/{uid}.bloqueadoPorPago`). Lo deja únicamente en su propia página,
 * donde ve el aviso y los accesos rápidos bloqueados; cualquier otra URL lo
 * devuelve allí. Escucha en vivo, así que al reactivarlo recupera el acceso sin
 * volver a iniciar sesión.
 */
export default function BloqueoPagoGuard({ children }: { children: JSX.Element }) {
  const { usuario, roles, loading } = useUsuarioActual();
  const location = useLocation();
  const [bloqueado, setBloqueado] = useState<boolean | null>(null);

  const esClientePuro =
    roles.includes("cliente") && !roles.some((r) => ROLES_INTERNOS.includes(r));

  useEffect(() => {
    if (loading) return;
    if (!usuario || !esClientePuro) {
      setBloqueado(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "clientes", usuario.uid),
      (snap) =>
        setBloqueado(snap.exists() && (snap.data() as any).bloqueadoPorPago === true),
      () => setBloqueado(false) // ante un error de lectura no dejamos al cliente encerrado
    );
    return unsub;
  }, [usuario?.uid, esClientePuro, loading]);

  if (esClientePuro && bloqueado === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
      </div>
    );
  }

  const paginaPropia = `/clientes/${usuario?.uid}`;
  if (bloqueado && location.pathname !== paginaPropia) {
    return <Navigate to={paginaPropia} replace />;
  }

  return children;
}
