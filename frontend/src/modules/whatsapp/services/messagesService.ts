import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  startAfter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { WaMessage } from "../models/waMessage.model";

function msgCol(numberId: string, convId: string) {
  return collection(db, `numbers/${numberId}/conversations/${convId}/messages`);
}

function mapMsg(d: QueryDocumentSnapshot): WaMessage {
  const data = d.data();
  return {
    id: d.id,
    role: data.role,
    text: data.text ?? "",
    timestampMs: data.ts?.toMillis?.() ?? Date.now(),
    source: data.source,
    providerMessageId: data.providerMessageId,
    ...(data.mediaUrl      ? { mediaUrl: data.mediaUrl }           : {}),
    ...(data.mediaType     ? { mediaType: data.mediaType }         : {}),
    ...(data.mediaFilename ? { mediaFilename: data.mediaFilename } : {}),
  };
}

// Escucha los últimos 30 mensajes en tiempo real
export function listenLatestMessages(
  numberId: string,
  convId: string,
  callback: (messages: WaMessage[]) => void
): () => void {
  const q = query(msgCol(numberId, convId), orderBy("ts", "desc"), limit(30));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(mapMsg).reverse());
  });
}

// Carga una página del histórico (paginación hacia atrás)
export async function fetchMessagesPage(
  numberId: string,
  convId: string,
  pageSize = 30,
  cursor?: QueryDocumentSnapshot
): Promise<{ messages: WaMessage[]; lastDoc: QueryDocumentSnapshot | null }> {
  const q = query(
    msgCol(numberId, convId),
    orderBy("ts", "desc"),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return {
    messages: snap.docs.map(mapMsg).reverse(),
    lastDoc: snap.docs.at(-1) ?? null,
  };
}
