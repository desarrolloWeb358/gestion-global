// src/modules/notificaciones/hooks/useNotificacionesUsuario.ts
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { NotificacionAlerta } from "@/modules/notificaciones/models/notificacion.model";

export function useNotificacionesUsuario(usuarioId?: string) {
  const [todas, setTodas] = useState<NotificacionAlerta[]>([]);
  const [totalNoVistas, setTotalNoVistas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubDisplay: Unsubscribe | null = null;
    let unsubCount: Unsubscribe | null = null;

    if (!usuarioId) {
      setTodas([]);
      setTotalNoVistas(0);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const baseCol = collection(db, `usuarios/${usuarioId}/notificaciones`);

    // Query 1: todas las notificaciones, no vistas primero luego más recientes
    const qTodas = query(
      baseCol,
      orderBy("visto", "asc"),
      orderBy("fecha", "desc")
    );

    unsubDisplay = onSnapshot(
      qTodas,
      (snap) => {
        const arr: NotificacionAlerta[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<NotificacionAlerta, "id">),
        }));
        setTodas(arr);
        setLoading(false);
      },
      (err) => {
        console.error("[NOTIFS] onSnapshot error:", err);

        // Fallback: if the composite index is missing, at least fetch the 10 most recent by date
        const msg = (err as any)?.message || "Error desconocido";
        setError(msg);

        try {
          const qFallback = query(baseCol, orderBy("fecha", "desc"));
          unsubDisplay?.();
          unsubDisplay = onSnapshot(
            qFallback,
            (snap2) => {
              const arr2: NotificacionAlerta[] = snap2.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<NotificacionAlerta, "id">),
              }));
              setTodas(arr2);
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

    // Query 2: Count ALL unread notifications — no limit, used solely for the badge count
    const qAllUnread = query(baseCol, where("visto", "==", false));

    unsubCount = onSnapshot(
      qAllUnread,
      (snap) => {
        setTotalNoVistas(snap.size);
      },
      (err) => {
        console.error("[NOTIFS] unread count onSnapshot error:", err);
      }
    );

    return () => {
      if (unsubDisplay) unsubDisplay();
      if (unsubCount) unsubCount();
    };
  }, [usuarioId]);

  const noVistas = useMemo(() => todas.filter((n) => !n.visto), [todas]);

  return {
    noVistas,
    todas,
    totalNoVistas,
    loading,
    error,
  };
}
