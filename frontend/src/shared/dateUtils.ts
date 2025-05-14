// src/shared/dateUtils.ts
import { Timestamp } from "firebase/firestore";

export const formatTimestamp = (
  timestamp: Timestamp | { seconds: number; nanoseconds: number } | null | undefined,
  format: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }
): string => {
  if (!timestamp) return "";
  const date =
    timestamp instanceof Timestamp
      ? timestamp.toDate()
      : new Date(timestamp.seconds * 1000);
  return date.toLocaleString("es-CO", format);
};
