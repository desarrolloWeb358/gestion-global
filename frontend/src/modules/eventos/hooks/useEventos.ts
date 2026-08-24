import { useEffect, useMemo, useState } from "react";
import type { Unsubscribe } from "firebase/firestore";
import { suscribirEventos, type RangoFechas } from "../services/eventoService";
import type { Evento } from "../models/evento.model";

/**
 * Se suscribe al rango visible del calendario con un colchon de un mes a cada
 * lado: FullCalendar ya pinta dias del mes anterior y siguiente en la vista de
 * mes, y el colchon evita reabrir la suscripcion al navegar de mes en mes.
 */
function conColchon(rango: RangoFechas): RangoFechas {
  const desde = new Date(rango.desde);
  desde.setMonth(desde.getMonth() - 1);
  const hasta = new Date(rango.hasta);
  hasta.setMonth(hasta.getMonth() + 1);
  return { desde, hasta };
}

export function useEventos(
  uid: string | undefined,
  verTodas: boolean,
  rango: RangoFechas | null
) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Las fechas son objetos nuevos en cada render; se comparan por su valor en ms
  // para no reabrir la suscripcion en cada pintada.
  const desdeMs = rango ? conColchon(rango).desde.getTime() : null;
  const hastaMs = rango ? conColchon(rango).hasta.getTime() : null;

  useEffect(() => {
    if (!uid || desdeMs === null || hastaMs === null) {
      setEventos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsub: Unsubscribe = suscribirEventos(
      {
        uid,
        verTodas,
        rango: { desde: new Date(desdeMs), hasta: new Date(hastaMs) },
      },
      (arr) => {
        setEventos(arr);
        setLoading(false);
      },
      (err) => {
        setError((err as any)?.message ?? "Error desconocido");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid, verTodas, desdeMs, hastaMs]);

  const eventosOrdenados = useMemo(
    () =>
      [...eventos].sort((a, b) => {
        const aMs = (a.inicio as any)?.toMillis?.() ?? 0;
        const bMs = (b.inicio as any)?.toMillis?.() ?? 0;
        return aMs - bMs;
      }),
    [eventos]
  );

  return { eventos: eventosOrdenados, loading, error };
}
