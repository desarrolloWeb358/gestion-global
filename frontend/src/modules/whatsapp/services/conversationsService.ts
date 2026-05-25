import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  updateDoc,
  where,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { WaConversation } from "../models/waConversation.model";
import type { WaMessage } from "../models/waMessage.model";

function mapLastMessages(raw: any[]): WaMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => ({
    id: m.providerMessageId ?? String(m.ts?.toMillis?.() ?? Date.now()),
    role: m.role,
    text: m.text,
    timestampMs: m.ts?.toMillis?.() ?? Date.now(),
    source: m.source,
    providerMessageId: m.providerMessageId,
  }));
}

function mapConversation(id: string, data: Record<string, any>): WaConversation {
  return {
    id,
    numberId: data.numberId ?? "",
    userAddress: data.userAddress ?? id,
    status: data.status ?? "OPEN",
    assigneeId: data.assigneeId ?? null,
    lastMessages: mapLastMessages(data.lastMessages),
    messageCount: data.messageCount ?? 0,
    lastMessageAt: data.lastMessageAt,
    lastInboundAt: data.lastInboundAt ?? null,
    unreadCount: data.unreadCount ?? 0,
    clienteId: data.clienteId ?? null,
    deudorId: data.deudorId ?? null,
    deudorNombre: data.deudorNombre ?? null,
    createdAt: data.createdAt,
  };
}

export function listenInbox(
  numberId: string,
  callback: (conversations: WaConversation[]) => void
): () => void {
  const q = query(
    collection(db, `numbers/${numberId}/conversations`),
    orderBy("lastMessageAt", "desc"),
    limit(300)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => mapConversation(d.id, d.data())));
  });
}

export function listenConversation(
  numberId: string,
  convId: string,
  callback: (conv: WaConversation | null) => void
): () => void {
  return onSnapshot(
    doc(db, `numbers/${numberId}/conversations/${convId}`),
    (snap) => {
      callback(snap.exists() ? mapConversation(snap.id, snap.data()!) : null);
    }
  );
}

const META_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 horas

// Devuelve true si el contacto respondió hace menos de 24h (ventana Meta abierta)
export function isMetaWindowOpen(
  lastInboundAt: { toMillis: () => number } | null | undefined
): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - lastInboundAt.toMillis() < META_WINDOW_MS;
}

export interface DeudorSearchResult {
  clienteId: string;
  deudorId: string;
  nombre: string;
  telefonos: string[];
  tipificacion?: string;
}

// Busca deudores cuyo array telefonos contiene el número dado
export async function searchDeudoresByPhone(
  phone: string
): Promise<DeudorSearchResult[]> {
  const normalized = phone.replace(/[^\d]/g, "");
  if (normalized.length < 7) return [];

  const snap = await getDocs(
    query(collectionGroup(db, "deudores"), where("telefonos", "array-contains", normalized))
  );

  return snap.docs.map((d) => {
    const parts = d.ref.path.split("/");
    const data = d.data();
    return {
      clienteId: parts[1],
      deudorId: parts[3],
      nombre: data.nombre ?? "",
      telefonos: data.telefonos ?? [],
      tipificacion: data.tipificacion ?? "",
    };
  });
}

// Vincula un deudor a la conversación Y agrega el teléfono al array telefonos del deudor
export async function linkDeudorToConversation(
  numberId: string,
  convId: string,
  clienteId: string,
  deudorId: string,
  deudorNombre: string,
  phone: string  // número de la conversación para agregar al deudor
): Promise<void> {
  const localPhone = phone.startsWith("57") && phone.length === 12
    ? phone.slice(2)
    : phone;

  await Promise.all([
    // Guarda referencia en la conversación
    updateDoc(doc(db, `numbers/${numberId}/conversations/${convId}`), {
      clienteId,
      deudorId,
      deudorNombre,
    }),
    // Agrega el teléfono al deudor si no lo tiene
    updateDoc(doc(db, `clientes/${clienteId}/deudores/${deudorId}`), {
      telefonos: arrayUnion(localPhone),
    }),
  ]);
}

// Carga el documento completo de un deudor
export async function getDeudorDoc(
  clienteId: string,
  deudorId: string
): Promise<Record<string, any> | null> {
  const snap = await getDoc(
    doc(db, `clientes/${clienteId}/deudores/${deudorId}`)
  );
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Busca todas las conversaciones vinculadas a un deudor (collection group query)
// Requiere índice en Firestore: conversations / deudorId (ASC)
export async function getConversationsByDeudorId(
  deudorId: string
): Promise<WaConversation[]> {
  const snap = await getDocs(
    query(collectionGroup(db, "conversations"), where("deudorId", "==", deudorId))
  );
  return snap.docs.map((d) => mapConversation(d.id, d.data() as Record<string, any>));
}

// Desvincula el deudor de la conversación y elimina el teléfono del array telefonos del deudor
export async function unlinkDeudorFromConversation(
  numberId: string,
  convId: string,
  clienteId: string,
  deudorId: string,
  phone: string
): Promise<void> {
  const localPhone = phone.startsWith("57") && phone.length === 12
    ? phone.slice(2)
    : phone;

  await Promise.all([
    updateDoc(doc(db, `numbers/${numberId}/conversations/${convId}`), {
      clienteId: null,
      deudorId: null,
      deudorNombre: null,
    }),
    updateDoc(doc(db, `clientes/${clienteId}/deudores/${deudorId}`), {
      telefonos: arrayRemove(localPhone),
    }),
  ]);
}

// Marca la conversación como leída (reset unreadCount)
export async function markConversationRead(
  numberId: string,
  convId: string
): Promise<void> {
  await updateDoc(doc(db, `numbers/${numberId}/conversations/${convId}`), {
    unreadCount: 0,
  });
}
