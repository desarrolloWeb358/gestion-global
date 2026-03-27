import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/firebase";
import type { ModuloApp } from "./auditLogModel";

interface RegistrarEliminacionParams {
  modulo: ModuloApp;
  descripcion: string;
  coleccionPath: string;
}

/**
 * Registra en Firestore la huella de un documento eliminado.
 * Nunca lanza error — si el log falla, la operación principal no se bloquea.
 */
export async function registrarEliminacion(
  params: RegistrarEliminacionParams
): Promise<void> {
  try {
    const uid = auth.currentUser?.uid ?? "desconocido";
    await addDoc(collection(db, "registrosEliminados"), {
      uid,
      modulo: params.modulo,
      descripcion: params.descripcion,
      coleccionPath: params.coleccionPath,
      fechaEliminacion: serverTimestamp(),
    });
  } catch {
    console.warn("[auditLog] No se pudo registrar la eliminación.");
  }
}