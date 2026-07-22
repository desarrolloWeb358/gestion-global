// src/modules/notificaciones/hooks/useNotificacionesUsuario.ts
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { NotificacionAlerta } from "@/modules/notificaciones/models/notificacion.model";
import type { Rol } from "@/shared/constants/acl";

async function filtrarValoresAgregadosTerminados(
  notificaciones: NotificacionAlerta[],
  roles: Rol[]
): Promise<NotificacionAlerta[]> {
  if (!roles.includes("admin")) return notificaciones;

  const resultados = await Promise.all(
    notificaciones.map(async (notificacion) => {
      const esValorAgregado = notificacion.modulo?.toLowerCase().includes("valor agregado");
      const match = notificacion.ruta?.match(
        /^\/clientes\/([^/]+)\/valores-agregados\/([^/]+)$/
      );
      if (!esValorAgregado || !match) return notificacion;

      try {
        const valorSnap = await getDoc(
          doc(db, `clientes/${match[1]}/valoresAgregados/${match[2]}`)
        );
        return valorSnap.exists() && valorSnap.data().completado === true
          ? null
          : notificacion;
      } catch (error) {
        console.error("[NOTIFS] Error consultando valor agregado:", error);
        return notificacion;
      }
    })
  );

  return resultados.filter((n): n is NotificacionAlerta => n !== null);
}

export function useNotificacionesUsuario(usuarioId?: string, roles: Rol[] = []) {
  const [todas, setTodas] = useState<NotificacionAlerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubDisplay: Unsubscribe | null = null;

    if (!usuarioId) {
      setTodas([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const baseCol = collection(db, `usuarios/${usuarioId}/notificaciones`);

    // Todas las notificaciones, no vistas primero luego más recientes
    const qTodas = query(
      baseCol,
      orderBy("visto", "asc"),
      orderBy("fecha", "desc")
    );

    unsubDisplay = onSnapshot(
      qTodas,
      async (snap) => {
        const arr: NotificacionAlerta[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<NotificacionAlerta, "id">),
          }))
          .filter((n) => n.resuelta !== true);
        setTodas(await filtrarValoresAgregadosTerminados(arr, roles));
        setLoading(false);
      },
      (err) => {
        console.error("[NOTIFS] onSnapshot error:", err);

        const msg = (err as any)?.message || "Error desconocido";
        setError(msg);

        try {
          const qFallback = query(baseCol, orderBy("fecha", "desc"));
          unsubDisplay?.();
          unsubDisplay = onSnapshot(
            qFallback,
            async (snap2) => {
              const arr2: NotificacionAlerta[] = snap2.docs
                .map((d) => ({
                  id: d.id,
                  ...(d.data() as Omit<NotificacionAlerta, "id">),
                }))
                .filter((n) => n.resuelta !== true);
              setTodas(await filtrarValoresAgregadosTerminados(arr2, roles));
              setLoading(false);
            },
            (err2) => {
              console.error("[NOTIFS] fallback onSnapshot error:", err2);
              setLoading(false);
            }
          );
        } catch {
          setLoading(false);
        }
      }
    );

    return () => {
      if (unsubDisplay) unsubDisplay();
    };
  }, [usuarioId, roles]);

  const noVistas = useMemo(() => todas.filter((n) => !n.visto), [todas]);

  return {
    noVistas,
    todas,
    totalNoVistas: noVistas.length,
    loading,
    error,
  };
}
