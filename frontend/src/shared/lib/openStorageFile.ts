import { ref, getDownloadURL } from "firebase/storage";
import { storage } from "@/firebase";

/**
 * Abre un archivo de Firebase Storage en una pestaña nueva.
 * - Si ya es una URL con token (https://...token=...) la abre directo.
 * - Si es una ruta o URL sin token, pide una URL fresca al SDK.
 */
export async function openStorageFile(stored: string): Promise<void> {
  if (stored.startsWith("https://") && stored.includes("token=")) {
    window.open(stored, "_blank", "noopener,noreferrer");
    return;
  }
  const fresh = await getDownloadURL(ref(storage, stored));
  window.open(fresh, "_blank", "noopener,noreferrer");
}
