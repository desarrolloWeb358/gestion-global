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
  writeBatch,
  Timestamp,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "@/firebase";
import { DEFAULT_EMAIL_TEMPLATES, type EmailTemplate } from "../emailTemplates";

export type EmailTemplateInput = Pick<EmailTemplate, "name" | "subject" | "body" | "attachDeudoresExcel">;

const templatesCol = collection(db, "emailTemplates");

export function listenEmailTemplates(
  onChange: (templates: EmailTemplate[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(templatesCol, orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EmailTemplate, "id">) }))),
    (error) => onError?.(error)
  );
}

export async function createEmailTemplate(data: EmailTemplateInput): Promise<string> {
  const ref = await addDoc(templatesCol, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function updateEmailTemplate(id: string, data: EmailTemplateInput): Promise<void> {
  await updateDoc(doc(templatesCol, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  await deleteDoc(doc(templatesCol, id));
}

/**
 * Copia las plantillas de arranque a la colección, con su mismo id (así el
 * `templateId` de las campañas viejas sigue apuntando a la misma plantilla).
 * El `createdAt` va escalonado para que conserven el orden del código.
 */
export async function seedDefaultEmailTemplates(): Promise<void> {
  const batch = writeBatch(db);
  const base = Date.now();
  DEFAULT_EMAIL_TEMPLATES.forEach((template, index) => {
    batch.set(doc(templatesCol, template.id), {
      name: template.name,
      subject: template.subject,
      body: template.body,
      attachDeudoresExcel: !!template.attachDeudoresExcel,
      createdAt: Timestamp.fromMillis(base + index),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}
