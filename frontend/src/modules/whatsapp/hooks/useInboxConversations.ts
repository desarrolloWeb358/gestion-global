import { useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase";
import { listenInbox } from "../services/conversationsService";
import type { WaConversation } from "../models/waConversation.model";
import type { Rol } from "@/shared/constants/acl";

export function useInboxConversations(numberId: string, uid: string, roles: Rol[]) {
  const [conversations, setConversations] = useState<WaConversation[]>([]);
  const [loading, setLoading] = useState(true);
  // clienteId → ejecutivoPrejuridicoId (null si no existe)
  const clienteCache = useRef<Record<string, string | null>>({});

  useEffect(() => {
    if (!numberId || !uid) return;
    setLoading(true);
    clienteCache.current = {};

    const isSuperAdmin = roles.includes("admin") || roles.includes("supervisor");

    const unsub = listenInbox(numberId, async (convs) => {
      if (isSuperAdmin) {
        setConversations(convs);
        setLoading(false);
        return;
      }

      const uncachedIds = [
        ...new Set(
          convs
            .filter((c) => c.clienteId && !(c.clienteId in clienteCache.current))
            .map((c) => c.clienteId!)
        ),
      ];

      if (uncachedIds.length > 0) {
        await Promise.all(
          uncachedIds.map(async (clienteId) => {
            const snap = await getDoc(doc(db, `clientes/${clienteId}`));
            clienteCache.current[clienteId] = snap.exists()
              ? (snap.data().ejecutivoPrejuridicoId ?? null)
              : null;
          })
        );
      }

      const filtered = convs.filter((conv) => {
        if (!conv.clienteId) return false;
        return clienteCache.current[conv.clienteId] === uid;
      });

      setConversations(filtered);
      setLoading(false);
    });

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberId, uid, roles.join(",")]);

  return { conversations, loading };
}
