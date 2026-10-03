import {
  collection,
  deleteDoc,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/firebase";
import { registrarEliminacion } from "@/shared/services/auditLog/auditLogService";
import { notificarUsuarioConAlerta } from "@/modules/notificaciones/services/notificacionService";
import { Tarea, TareaEstado, TareaPrioridad } from "../models/tarea.model";

const RUTA_TAREAS = "/tareas";

function colRef() {
  return collection(db, "tareas");
}
function docRef(tareaId: string) {
  return doc(db, "tareas", tareaId);
}

function mapDocToTarea(id: string, data: any): Tarea {
  return {
    id,
    titulo: data.titulo ?? "",
    descripcion: data.descripcion ?? "",
    prioridad: (data.prioridad ?? "media") as TareaPrioridad,
    estado: (data.estado ?? "pendiente") as TareaEstado,
    fechaLimite: data.fechaLimite ?? null,
    asignadoA: data.asignadoA ?? "",
    asignadoNombre: data.asignadoNombre ?? "",
    creadoPor: data.creadoPor ?? "",
    creadoPorNombre: data.creadoPorNombre ?? "",
    fechaCreacion: data.fechaCreacion,
    fechaActualizacion: data.fechaActualizacion,
    fechaFinalizacion: data.fechaFinalizacion ?? null,
  };
}

// =====================================================
// 📋 CRUD Tarea
// =====================================================
type ActorInfo = { uid: string; nombre?: string };

export type CrearTareaInput = {
  titulo: string;
  descripcion?: string;
  prioridad: TareaPrioridad;
  fechaLimite?: Timestamp | null;
  asignadoA: string;
  asignadoNombre?: string;
};

export async function crearTarea(
  data: CrearTareaInput,
  actor: ActorInfo
): Promise<string> {
  const payload = {
    titulo: data.titulo.trim(),
    descripcion: data.descripcion?.trim() ?? "",
    prioridad: data.prioridad,
    estado: "pendiente" as TareaEstado,
    fechaLimite: data.fechaLimite ?? null,
    asignadoA: data.asignadoA,
    asignadoNombre: data.asignadoNombre ?? "",
    creadoPor: actor.uid,
    creadoPorNombre: actor.nombre ?? "",
    fechaCreacion: serverTimestamp(),
    fechaActualizacion: serverTimestamp(),
    fechaFinalizacion: null,
  };

  const created = await addDoc(colRef(), payload);

  try {
    await notificarUsuarioConAlerta({
      usuarioId: data.asignadoA,
      modulo: "tarea",
      ruta: RUTA_TAREAS,
      descripcion: `Se te asignó una nueva tarea: ${data.titulo}`,
    });
  } catch (err) {
    console.error("[crearTarea] Error al notificar al asignado:", err);
  }

  return created.id;
}

export type ActualizarTareaPatch = Partial<{
  titulo: string;
  descripcion: string;
  prioridad: TareaPrioridad;
  fechaLimite: Timestamp | null;
  asignadoA: string;
  asignadoNombre: string;
}>;

export async function actualizarTarea(
  tareaId: string,
  patch: ActualizarTareaPatch
): Promise<void> {
  const basePatch: Record<string, any> = {
    fechaActualizacion: serverTimestamp(),
  };
  if (patch.titulo !== undefined) basePatch.titulo = patch.titulo.trim();
  if (patch.descripcion !== undefined) basePatch.descripcion = patch.descripcion.trim();
  if (patch.prioridad !== undefined) basePatch.prioridad = patch.prioridad;
  if (patch.fechaLimite !== undefined) basePatch.fechaLimite = patch.fechaLimite;
  if (patch.asignadoA !== undefined) basePatch.asignadoA = patch.asignadoA;
  if (patch.asignadoNombre !== undefined) basePatch.asignadoNombre = patch.asignadoNombre;

  await updateDoc(docRef(tareaId), basePatch);

  // Reasignación: notificar al nuevo asignado
  if (patch.asignadoA) {
    try {
      await notificarUsuarioConAlerta({
        usuarioId: patch.asignadoA,
        modulo: "tarea",
        ruta: RUTA_TAREAS,
        descripcion: `Se te asignó una tarea: ${patch.titulo ?? "Tarea"}`,
      });
    } catch (err) {
      console.error("[actualizarTarea] Error al notificar reasignación:", err);
    }
  }
}

export async function cambiarEstadoTarea(
  tareaId: string,
  nuevoEstado: TareaEstado,
  creadoPor?: string,
  titulo?: string
): Promise<void> {
  const patch: Record<string, any> = {
    estado: nuevoEstado,
    fechaActualizacion: serverTimestamp(),
    fechaFinalizacion: nuevoEstado === "finalizada" ? serverTimestamp() : null,
  };

  await updateDoc(docRef(tareaId), patch);

  if (nuevoEstado === "finalizada" && creadoPor) {
    try {
      await notificarUsuarioConAlerta({
        usuarioId: creadoPor,
        modulo: "tarea",
        ruta: RUTA_TAREAS,
        descripcion: `La tarea "${titulo ?? ""}" fue marcada como finalizada.`,
      });
    } catch (err) {
      console.error("[cambiarEstadoTarea] Error al notificar finalización:", err);
    }
  }
}

export async function eliminarTarea(tareaId: string, titulo?: string): Promise<void> {
  await deleteDoc(docRef(tareaId));
  await registrarEliminacion({
    modulo: "tarea",
    descripcion: titulo ?? tareaId,
    coleccionPath: "tareas",
  });
}

// =====================================================
// 🔴 Suscripciones en tiempo real
// =====================================================
export function suscribirTareas(
  callback: (tareas: Tarea[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  return onSnapshot(
    colRef(),
    (snap) => {
      const arr = snap.docs.map((d) => mapDocToTarea(d.id, d.data()));
      callback(arr);
    },
    (err) => {
      console.error("[suscribirTareas] onSnapshot error:", err);
      onError?.(err);
    }
  );
}

/**
 * Tareas donde el usuario participa: las que tiene asignadas Y las que él
 * mismo creó (aunque se las haya asignado a otra persona). Se combinan dos
 * listeners porque Firestore no permite el OR entre campos distintos con
 * onSnapshot de forma directa.
 */
export function suscribirTareasPropias(
  uid: string,
  callback: (tareas: Tarea[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  let asignadas: Tarea[] = [];
  let creadas: Tarea[] = [];

  function emitir() {
    const porId = new Map<string, Tarea>();
    for (const t of asignadas) porId.set(t.id!, t);
    for (const t of creadas) porId.set(t.id!, t);
    callback(Array.from(porId.values()));
  }

  const unsubAsignadas = onSnapshot(
    query(colRef(), where("asignadoA", "==", uid)),
    (snap) => {
      asignadas = snap.docs.map((d) => mapDocToTarea(d.id, d.data()));
      emitir();
    },
    (err) => {
      console.error("[suscribirTareasPropias] Error (asignadoA):", err);
      onError?.(err);
    }
  );

  const unsubCreadas = onSnapshot(
    query(colRef(), where("creadoPor", "==", uid)),
    (snap) => {
      creadas = snap.docs.map((d) => mapDocToTarea(d.id, d.data()));
      emitir();
    },
    (err) => {
      console.error("[suscribirTareasPropias] Error (creadoPor):", err);
      onError?.(err);
    }
  );

  return () => {
    unsubAsignadas();
    unsubCreadas();
  };
}
