import { useEffect, useState } from "react";
import { getClienteIdsByEjecutivo } from "../services/conversationsService";

/**
 * Conjuntos a cargo del usuario. Sirve para dos cosas:
 *  - saber si además de admin/ejecutivoAdmin tiene cartera propia
 *  - separar "mis conversaciones" del resto en el badge del menú
 *
 * clienteIds === null mientras carga.
 */
export function useMiCartera(uid: string | undefined) {
  const [clienteIds, setClienteIds] = useState<string[] | null>(null);

  useEffect(() => {
    if (!uid) {
      setClienteIds(null);
      return;
    }
    let cancelled = false;
    setClienteIds(null);

    getClienteIdsByEjecutivo(uid)
      .then((ids) => { if (!cancelled) setClienteIds(ids); })
      .catch(() => { if (!cancelled) setClienteIds([]); });

    return () => { cancelled = true; };
  }, [uid]);

  return { clienteIds, loading: clienteIds === null, tieneCartera: (clienteIds?.length ?? 0) > 0 };
}
