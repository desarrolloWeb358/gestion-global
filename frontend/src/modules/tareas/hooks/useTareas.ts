import { useEffect, useState } from "react";
import type { Unsubscribe } from "firebase/firestore";
import { suscribirTareas, suscribirTareasPropias } from "../services/tareaService";
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
 * El resto (verTodas=false) recibe las suyas: las que tiene asignadas y
 * también las que él mismo creó (para poder hacerles seguimiento aunque
 * se las haya asignado a otra persona).
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
      unsub = suscribirTareasPropias(uid, (arr) => {
        setTareas(ordenarPorFechaCreacionDesc(arr));
        setLoading(false);
      }, onErr);
    }

    return () => unsub();
  }, [uid, verTodas]);

  return { tareas, loading, error };
}
