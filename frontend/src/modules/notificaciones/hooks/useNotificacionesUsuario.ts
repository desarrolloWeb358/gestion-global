// src/modules/notificaciones/hooks/useNotificacionesUsuario.ts
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { NotificacionAlerta } from "@/modules/notificaciones/models/notificacion.model";

export function useNotificacionesUsuario(usuarioId?: string) {
  const [noVistas, setNoVistas] = useState<NotificacionAlerta[]>([]);
  const [todas, setTodas] = useState<NotificacionAlerta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usuarioId) return;

    const baseCol = collection(db, `usuarios/${usuarioId}/notificaciones`);

    // No vistas
    const qNoVistas = query(
      baseCol,
      where("visto", "==", false),
      orderBy("fecha", "desc")
    );

    const unsubNoVistas = onSnapshot(qNoVistas, (snap) => {
      const arr: NotificacionAlerta[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<NotificacionAlerta, "id">;
        arr.push({ id: d.id, ...data });
      });
      setNoVistas(arr);
    });

    // Todas (por si quieres una página de historial)
    const qTodas = query(baseCol, orderBy("fecha", "desc"));
    const unsubTodas = onSnapshot(qTodas, (snap) => {
      const arr: NotificacionAlerta[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<NotificacionAlerta, "id">;
        arr.push({ id: d.id, ...data });
      });
      setTodas(arr);
      setLoading(false);
    });

    return () => {
      unsubNoVistas();
      unsubTodas();
    };
  }, [usuarioId]);

  return {
    noVistas,
    todas,
    totalNoVistas: noVistas.length,
    loading,
  };
}
