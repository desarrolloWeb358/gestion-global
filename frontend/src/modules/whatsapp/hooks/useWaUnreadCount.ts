import { useEffect, useState } from "react";
import { collectionGroup, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/firebase";

// Devuelve la cantidad de conversaciones (no mensajes) con unreadCount > 0
export function useWaUnreadCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const q = query(
      collectionGroup(db, "conversations"),
      where("unreadCount", ">", 0)
    );
    return onSnapshot(q, (snap) => {
      setCount(snap.size);
    });
  }, []);

  return count;
}
