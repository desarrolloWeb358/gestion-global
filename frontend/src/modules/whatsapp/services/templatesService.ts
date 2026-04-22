import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { WaTemplate } from "../models/waTemplate.model";

function templatesCol(numberId: string) {
  return collection(db, "numbers", numberId, "templates");
}

export function listenTemplates(
  numberId: string,
  onChange: (templates: WaTemplate[]) => void
): Unsubscribe {
  const q = query(templatesCol(numberId), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    const templates = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<WaTemplate, "id">),
    }));
    onChange(templates);
  });
}

export async function createTemplate(
  numberId: string,
  data: Omit<WaTemplate, "id" | "numberId" | "createdAt">
): Promise<string> {
  const ref = await addDoc(templatesCol(numberId), {
    ...data,
    numberId,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTemplate(
  numberId: string,
  templateId: string,
  data: Partial<Omit<WaTemplate, "id" | "numberId" | "createdAt">>
): Promise<void> {
  await updateDoc(doc(db, "numbers", numberId, "templates", templateId), data);
}

export async function deleteTemplate(
  numberId: string,
  templateId: string
): Promise<void> {
  await deleteDoc(doc(db, "numbers", numberId, "templates", templateId));
}
