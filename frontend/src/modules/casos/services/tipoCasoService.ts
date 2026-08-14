// modules/casos/services/tipoCasoService.ts
//
// Catálogo de tipos de caso. Sigue la convención ya establecida por
// etiquetaDemandaService: los catálogos internos son DOCUMENTOS de la
// colección `configuracion`, nunca colecciones raíz nuevas.
//   configuracion/tiposCaso → { items: TipoCaso[] }
import { db } from "@/firebase";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { registrarEliminacion } from "@/shared/services/auditLog/auditLogService";
import type { TipoCaso } from "../models/tipoCaso.model";

const CONFIG_PATH = "configuracion/tiposCaso";

function configDocRef() {
  return doc(db, CONFIG_PATH);
}

async function leerItems(): Promise<TipoCaso[]> {
  const snap = await getDoc(configDocRef());
  if (!snap.exists()) return [];
  const data = snap.data() as { items?: TipoCaso[] };
  return Array.isArray(data.items) ? data.items : [];
}

async function guardarItems(items: TipoCaso[]): Promise<void> {
  await setDoc(configDocRef(), { items }, { merge: true });
}

function nuevoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function getTiposCaso(soloActivos = false): Promise<TipoCaso[]> {
  const items = await leerItems();
  const ordenados = [...items].sort((a, b) =>
    (a.nombre ?? "").localeCompare(b.nombre ?? "", "es")
  );
  return soloActivos ? ordenados.filter((t) => t.activo !== false) : ordenados;
}

export async function crearTipoCaso(data: {
  nombre: string;
  activo?: boolean;
}): Promise<string> {
  const items = await leerItems();
  const id = nuevoId();
  items.push({
    id,
    nombre: data.nombre.trim(),
    activo: data.activo ?? true,
    fechaCreacion: Timestamp.now(),
  });
  await guardarItems(items);
  return id;
}

export async function actualizarTipoCaso(
  id: string,
  patch: Partial<Pick<TipoCaso, "nombre" | "activo">>
): Promise<void> {
  const items = await leerItems();
  const next = items.map((t) =>
    t.id === id
      ? {
          ...t,
          ...(patch.nombre !== undefined ? { nombre: patch.nombre.trim() } : {}),
          ...(patch.activo !== undefined ? { activo: patch.activo } : {}),
        }
      : t
  );
  await guardarItems(next);
}

export async function eliminarTipoCaso(id: string, nombre?: string): Promise<void> {
  const items = await leerItems();
  await guardarItems(items.filter((t) => t.id !== id));
  await registrarEliminacion({
    modulo: "tiposCaso",
    descripcion: nombre ?? id,
    coleccionPath: CONFIG_PATH,
  });
}
