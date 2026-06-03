import { useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import {
  searchConversationsByPhone,
  searchConversationsByClienteId,
} from "../services/conversationsService";
import type { WaConversation } from "../models/waConversation.model";
import type { Rol } from "@/shared/constants/acl";

export type SearchMode = "phone" | "cliente";

export function useConversationSearch(
  numberId: string,
  mode: SearchMode,
  term: string,
  uid: string,
  roles: Rol[],
  clienteId?: string  // solo para mode === "cliente"
) {
  const [results, setResults] = useState<WaConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const clienteCache = useRef<Record<string, string | null>>({});

  const isFullAccess =
    roles.includes("admin") ||
    roles.includes("supervisor") ||
    roles.includes("ejecutivoAdmin");

  useEffect(() => {
    const active = mode === "cliente" ? !!clienteId : term.trim().length >= 3;

    if (!active || !numberId || !uid) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const run = async () => {
      let convs: WaConversation[] = [];

      if (mode === "phone") {
        convs = await searchConversationsByPhone(numberId, term.trim());
      } else if (mode === "cliente" && clienteId) {
        convs = await searchConversationsByClienteId(numberId, clienteId);
      }

      if (cancelled) return;

      // Admin y ejecutivoAdmin ven todo sin filtro adicional
      if (isFullAccess) {
        setResults(convs);
        setLoading(false);
        return;
      }

      // Modo cliente: el clienteId ya proviene de listarClientesWhatsapp (filtrado por rol)
      if (mode === "cliente") {
        setResults(convs);
        setLoading(false);
        return;
      }

      // Modo phone para ejecutivo: filtrar por clientes asignados
      const uncachedIds = [
        ...new Set(
          convs
            .filter((c) => c.clienteId && !(c.clienteId in clienteCache.current))
            .map((c) => c.clienteId!)
        ),
      ];

      await Promise.all(
        uncachedIds.map(async (cId) => {
          const snap = await getDoc(doc(db, `clientes/${cId}`));
          clienteCache.current[cId] = snap.exists()
            ? (snap.data().ejecutivoPrejuridicoId ?? null)
            : null;
        })
      );

      if (cancelled) return;

      const filtered = convs.filter((conv) => {
        if (!conv.clienteId) return false;
        return clienteCache.current[conv.clienteId] === uid;
      });

      setResults(filtered);
      setLoading(false);
    };

    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberId, mode, term, uid, roles.join(","), clienteId]);

  return { results, loading };
}
