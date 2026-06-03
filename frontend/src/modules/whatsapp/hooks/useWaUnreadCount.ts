import { useEffect, useRef, useState } from "react";
import { collectionGroup, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/firebase";
import type { Rol } from "@/shared/constants/acl";

export function useWaUnreadCount(uid: string | undefined, roles: Rol[]): number {
  const [count, setCount] = useState(0);
  const clienteCache = useRef<Record<string, string | null>>({});
  const callIdRef = useRef(0);

  useEffect(() => {
    if (!uid) {
      setCount(0);
      return;
    }

    const isFullAccess =
      roles.includes("admin") ||
      roles.includes("supervisor") ||
      roles.includes("ejecutivoAdmin");

    const q = query(
      collectionGroup(db, "conversations"),
      where("unreadCount", ">", 0)
    );

    return onSnapshot(q, async (snap) => {
      const callId = ++callIdRef.current;

      if (isFullAccess) {
        setCount(snap.size);
        return;
      }

      const uncachedIds = [
        ...new Set(
          snap.docs
            .map((d) => d.data().clienteId as string | null | undefined)
            .filter((id): id is string => !!id && !(id in clienteCache.current))
        ),
      ];

      await Promise.all(
        uncachedIds.map(async (clienteId) => {
          const clienteSnap = await getDoc(doc(db, `clientes/${clienteId}`));
          clienteCache.current[clienteId] = clienteSnap.exists()
            ? (clienteSnap.data().ejecutivoPrejuridicoId ?? null)
            : null;
        })
      );

      if (callId !== callIdRef.current) return;

      const relevant = snap.docs.filter((d) => {
        const clienteId = d.data().clienteId as string | null | undefined;
        if (!clienteId) return false;
        return clienteCache.current[clienteId] === uid;
      });

      setCount(relevant.length);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, roles.join(",")]);

  return count;
}
