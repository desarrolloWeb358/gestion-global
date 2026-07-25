// modules/cobranza/services/etiquetaDemandaService.ts
//
// Las etiquetas de demanda son un CATÁLOGO de configuración interna, no una entidad
// de negocio. Por eso NO viven en una colección raíz propia, sino consolidadas en:
//   configuracion/etiquetasDemanda   → documento con { items: EtiquetaDemanda[] }
// Futuros catálogos ("tipos de notificación", etc.) van como nuevos DOCUMENTOS de
// la colección `configuracion`, nunca como colecciones raíz nuevas.
import { db } from "@/firebase";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { registrarEliminacion } from "@/shared/services/auditLog/auditLogService";
import type { EtiquetaDemanda } from "../models/etiquetaDemanda.model";

const CONFIG_PATH = "configuracion/etiquetasDemanda";

function configDocRef() {
  return doc(db, CONFIG_PATH);
}

async function leerItems(): Promise<EtiquetaDemanda[]> {
  const snap = await getDoc(configDocRef());
  if (!snap.exists()) return [];
  const data = snap.data() as { items?: EtiquetaDemanda[] };
  return Array.isArray(data.items) ? data.items : [];
}

async function guardarItems(items: EtiquetaDemanda[]): Promise<void> {
  await setDoc(configDocRef(), { items }, { merge: true });
}

function nuevoId(): string {
  // Ids estables para los items del array (Firestore no autogenera dentro de arrays)
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `et_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function getEtiquetasDemanda(
  soloActivas = false
): Promise<EtiquetaDemanda[]> {
  const items = await leerItems();
  const ordenadas = [...items].sort((a, b) =>
    (a.nombre ?? "").localeCompare(b.nombre ?? "", "es")
  );
  return soloActivas ? ordenadas.filter((e) => e.activo !== false) : ordenadas;
}

export async function crearEtiquetaDemanda(data: {
  nombre: string;
  color?: string;
  activo?: boolean;
}): Promise<string> {
  const items = await leerItems();
  const id = nuevoId();
  items.push({
    id,
    nombre: data.nombre.trim(),
    color: data.color ?? "",
    activo: data.activo ?? true,
    fechaCreacion: Timestamp.now(),
  });
  await guardarItems(items);
  return id;
}

export async function actualizarEtiquetaDemanda(
  id: string,
  patch: Partial<Pick<EtiquetaDemanda, "nombre" | "color" | "activo">>
): Promise<void> {
  const items = await leerItems();
  const next = items.map((e) =>
    e.id === id
      ? {
          ...e,
          ...(patch.nombre !== undefined ? { nombre: patch.nombre.trim() } : {}),
          ...(patch.color !== undefined ? { color: patch.color } : {}),
          ...(patch.activo !== undefined ? { activo: patch.activo } : {}),
        }
      : e
  );
  await guardarItems(next);
}

export async function eliminarEtiquetaDemanda(
  id: string,
  nombre?: string
): Promise<void> {
  const items = await leerItems();
  await guardarItems(items.filter((e) => e.id !== id));
  await registrarEliminacion({
    modulo: "etiquetasDemanda",
    descripcion: nombre ?? id,
    coleccionPath: CONFIG_PATH,
  });
}
