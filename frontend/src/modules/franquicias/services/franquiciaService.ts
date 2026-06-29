// services/franquiciaService.ts
// Lectura de franquicias. La creación/edición de franquicias se hace por script
// (migracion/seed-franquicias.js), no desde la app.
import { db } from "@/firebase";
import { collection, getDocs, doc, getDoc, orderBy, query } from "firebase/firestore";
import { Franquicia } from "../models/franquicia.model";

const franquiciasRef = collection(db, "franquicias");

export async function obtenerFranquicias(): Promise<Franquicia[]> {
  const qy = query(franquiciasRef, orderBy("nombre", "asc"));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Franquicia, "id">) }));
}

export async function getFranquiciaById(id: string): Promise<Franquicia | null> {
  const snap = await getDoc(doc(db, "franquicias", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Franquicia, "id">) };
}
