import type { Timestamp } from "firebase/firestore";
import type { WaMessage } from "./waMessage.model";

export interface WaConversation {
  id: string;             // = userAddress (ej: "573001234567")
  numberId: string;
  userAddress: string;    // número del contacto sin prefijo
  status: "OPEN" | "CLOSED";
  assigneeId?: string | null;
  lastMessages: WaMessage[];
  messageCount: number;
  lastMessageAt: Timestamp;
  lastInboundAt?: Timestamp | null;
  unreadCount: number;
  clienteId?: string | null;
  deudorId?: string | null;
  deudorNombre?: string | null;
  createdAt: Timestamp;
}
