// modules/tareas/services/tareaSeguimientoService.ts
//
// Bitácora de avance por tarea: tareas/{tareaId}/seguimientos/{id}
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { TareaSeguimiento } from "../models/tareaSeguimiento.model";

function seguimientosColRef(tareaId: string) {
  return collection(db, "tareas", tareaId, "seguimientos");
}

export function suscribirSeguimientosTarea(
  tareaId: string,
  callback: (seguimientos: TareaSeguimiento[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const q = query(seguimientosColRef(tareaId), orderBy("fecha", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as TareaSeguimiento) }));
      callback(arr);
    },
    (err) => {
      console.error("[suscribirSeguimientosTarea] onSnapshot error:", err);
      onError?.(err);
    }
  );
}

export async function addSeguimientoTarea(
  tareaId: string,
  texto: string,
  autor: { uid: string; nombre?: string }
): Promise<string> {
  const created = await addDoc(seguimientosColRef(tareaId), {
    texto: texto.trim(),
    creadoPor: autor.uid,
    creadoPorNombre: autor.nombre ?? "",
    fecha: serverTimestamp(),
  });
  return created.id;
}
