import { useEffect, useState } from "react";
import type { Unsubscribe } from "firebase/firestore";
import { suscribirTareas, suscribirTareasPorAsignado } from "../services/tareaService";
import type { Tarea } from "../models/tarea.model";

function ordenarPorFechaCreacionDesc(tareas: Tarea[]): Tarea[] {
  return [...tareas].sort((a, b) => {
    const aMs = (a.fechaCreacion as any)?.toMillis?.() ?? 0;
    const bMs = (b.fechaCreacion as any)?.toMillis?.() ?? 0;
    return bMs - aMs;
  });
}

/**
 * Admin/ejecutivoAdmin (verTodas=true) reciben todas las tareas.
 * Ejecutivo (verTodas=false) recibe solo las suyas.
 */
export function useTareas(uid: string | undefined, verTodas: boolean) {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setTareas([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let unsub: Unsubscribe;
    const onErr = (err: unknown) => {
      setError((err as any)?.message ?? "Error desconocido");
      setLoading(false);
    };

    if (verTodas) {
      unsub = suscribirTareas((arr) => {
        setTareas(ordenarPorFechaCreacionDesc(arr));
        setLoading(false);
      }, onErr);
    } else {
      unsub = suscribirTareasPorAsignado(uid, (arr) => {
        setTareas(ordenarPorFechaCreacionDesc(arr));
        setLoading(false);
      }, onErr);
    }

    return () => unsub();
  }, [uid, verTodas]);

  return { tareas, loading, error };
}
