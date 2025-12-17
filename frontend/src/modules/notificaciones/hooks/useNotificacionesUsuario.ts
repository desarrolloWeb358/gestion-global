// src/modules/notificaciones/hooks/useNotificacionesUsuario.ts
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { NotificacionAlerta } from "@/modules/notificaciones/models/notificacion.model";

export function useNotificacionesUsuario(usuarioId?: string) {
  const [todas, setTodas] = useState<NotificacionAlerta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usuarioId) {
      setTodas([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const baseCol = collection(db, `usuarios/${usuarioId}/notificaciones`);

    const qTop10 = query(
      baseCol,
      orderBy("visto", "asc"),   
      orderBy("fecha", "desc"),  
      limit(10)
    );

    const unsub = onSnapshot(
      qTop10,
      (snap) => {
        const arr: NotificacionAlerta[] = [];
        snap.forEach((d) => {
          const data = d.data() as Omit<NotificacionAlerta, "id">;
          arr.push({ id: d.id, ...data });
        });
        setTodas(arr);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [usuarioId]);

  const noVistas = useMemo(() => todas.filter((n) => !n.visto), [todas]);

  return {
    noVistas,
    todas,
    totalNoVistas: noVistas.length,
    loading,
  };
}
