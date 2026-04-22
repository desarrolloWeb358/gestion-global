import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/firebase";
import type { WaNumber } from "../models/waNumber.model";

function mapNumber(id: string, data: Record<string, any>): WaNumber {
  return {
    id,
    displayName: data.displayName ?? id,
    phoneNumberId: data.phoneNumberId ?? "",
    createdAt: data.createdAt,
  };
}

export function listenNumbers(callback: (numbers: WaNumber[]) => void): () => void {
  // Sin orderBy: los números son pocos y no cambian seguido
  const q = query(collection(db, "numbers"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => mapNumber(d.id, d.data())));
  });
}
