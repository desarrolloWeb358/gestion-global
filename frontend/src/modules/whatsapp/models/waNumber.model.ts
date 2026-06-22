import type { Timestamp } from "firebase/firestore";

export interface WaNumber {
  id: string;
  displayName: string;
  phoneNumberId: string;  // ID del número en Meta (no el token — ese solo vive en backend)
  createdAt: Timestamp;
}
