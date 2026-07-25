// modules/cobranza/services/etiquetaDemandaService.ts
import { db } from "@/firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { registrarEliminacion } from "@/shared/services/auditLog/auditLogService";
import type { EtiquetaDemanda } from "../models/etiquetaDemanda.model";

const COL = "etiquetasDemanda";

export async function getEtiquetasDemanda(
  soloActivas = false
): Promise<EtiquetaDemanda[]> {
  const snap = await getDocs(query(collection(db, COL), orderBy("nombre", "asc")));
  const items = snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as EtiquetaDemanda) })
  );
  return soloActivas ? items.filter((e) => e.activo !== false) : items;
}

export async function crearEtiquetaDemanda(data: {
  nombre: string;
  color?: string;
  activo?: boolean;
}): Promise<string> {
  const payload = {
    nombre: data.nombre.trim(),
    color: data.color ?? "",
    activo: data.activo ?? true,
    fechaCreacion: Timestamp.now(),
  };
  const ref = await addDoc(collection(db, COL), payload);
  return ref.id;
}

export async function actualizarEtiquetaDemanda(
  id: string,
  patch: Partial<Pick<EtiquetaDemanda, "nombre" | "color" | "activo">>
): Promise<void> {
  const next: Record<string, any> = {};
  if (patch.nombre !== undefined) next.nombre = patch.nombre.trim();
  if (patch.color !== undefined) next.color = patch.color;
  if (patch.activo !== undefined) next.activo = patch.activo;
  await updateDoc(doc(db, COL, id), next);
}

export async function eliminarEtiquetaDemanda(
  id: string,
  nombre?: string
): Promise<void> {
  await deleteDoc(doc(db, COL, id));
  await registrarEliminacion({
    modulo: "etiquetasDemanda",
    descripcion: nombre ?? id,
    coleccionPath: COL,
  });
}
