// src/modules/notificaciones/hooks/useNotificacionesUsuario.ts
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { NotificacionAlerta } from "@/modules/notificaciones/models/notificacion.model";

export function useNotificacionesUsuario(usuarioId?: string) {
  const [todas, setTodas] = useState<NotificacionAlerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsub: Unsubscribe | null = null;

    if (!usuarioId) {
      setTodas([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const baseCol = collection(db, `usuarios/${usuarioId}/notificaciones`);

    // ✅ Query principal: NO vistas primero + más recientes
    // Requiere índice compuesto: (visto asc, fecha desc)
    const qTop10 = query(
      baseCol,
      orderBy("visto", "asc"),
      orderBy("fecha", "desc"),
      limit(10)
    );

    unsub = onSnapshot(
      qTop10,
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

        // 🔁 Fallback: si falta el índice compuesto, al menos trae las 10 más recientes por fecha
        // (esto evita que “no muestre nada”)
        const msg = (err as any)?.message || "Error desconocido";
        setError(msg);

        try {
          const qFallback = query(baseCol, orderBy("fecha", "desc"), limit(10));
          unsub?.(); // cierro el listener anterior
          unsub = onSnapshot(
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

    return () => {
      if (unsub) unsub();
    };
  }, [usuarioId]);

  const noVistas = useMemo(() => todas.filter((n) => !n.visto), [todas]);

  return {
    noVistas,
    todas,
    totalNoVistas: noVistas.length,
    loading,
    error, // 👈 para que NotificacionesPage muestre el problema si ocurre
  };
}
