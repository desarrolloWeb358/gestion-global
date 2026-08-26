// src/modules/notificaciones/hooks/useNotificacionesUsuario.ts
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { NotificacionAlerta } from "@/modules/notificaciones/models/notificacion.model";

/**
 * Lee las notificaciones del usuario y ya. Antes este hook además consultaba, solo
 * para el rol admin, el documento de cada valor agregado para esconder los que
 * estaban "completados" — un getDoc por notificación en CADA emisión del snapshot,
 * y una semántica distinta según quién mirara la misma pantalla.
 *
 * Eso se fue: la bandeja de pendientes de valores agregados es ahora una pantalla
 * propia (ReporteValoresAgregadosPage). Aquí una notificación significa una sola
 * cosa — "pasó algo, ve a verlo" — y `visto` es lo único que la apaga.
 */
export function useNotificacionesUsuario(usuarioId?: string) {
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

    const mapear = (snap: { docs: any[] }): NotificacionAlerta[] =>
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<NotificacionAlerta, "id">),
      }));

    // Todas las notificaciones, no vistas primero luego más recientes
    const qTodas = query(baseCol, orderBy("visto", "asc"), orderBy("fecha", "desc"));

    unsubDisplay = onSnapshot(
      qTodas,
      (snap) => {
        setTodas(mapear(snap));
        setLoading(false);
      },
      (err) => {
        console.error("[NOTIFS] onSnapshot error:", err);
        setError((err as any)?.message || "Error desconocido");

        // Fallback sin el orderBy compuesto, por si falta el índice.
        try {
          const qFallback = query(baseCol, orderBy("fecha", "desc"));
          unsubDisplay?.();
          unsubDisplay = onSnapshot(
            qFallback,
            (snap2) => {
              setTodas(mapear(snap2));
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
  }, [usuarioId]);

  const noVistas = useMemo(() => todas.filter((n) => !n.visto), [todas]);

  return {
    noVistas,
    todas,
    totalNoVistas: noVistas.length,
    loading,
    error,
  };
}
