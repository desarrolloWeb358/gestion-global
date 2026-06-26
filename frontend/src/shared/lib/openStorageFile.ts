import { ref, getDownloadURL } from "firebase/storage";
import { storage } from "@/firebase";

/**
 * Abre un archivo de Firebase Storage en una pestaña nueva.
 *
 * No confía en el string guardado en Firestore: lo usa solo para ubicar el
 * objeto (acepta ruta, gs://, o URL https con o sin token) y pide al SDK una
 * URL de descarga FRESCA (con token válido) en el momento del click, estando
 * el usuario autenticado.
 *
 * Esto evita los 403 "Permission denied" causados por URLs guardadas sin
 * `?alt=media&token=...` y maneja con un mensaje limpio el caso de archivo
 * inexistente (404 / object-not-found).
 */
export async function openStorageFile(stored: string): Promise<void> {
  const fresh = await getDownloadURL(ref(storage, stored));
  window.open(fresh, "_blank", "noopener,noreferrer");
}
