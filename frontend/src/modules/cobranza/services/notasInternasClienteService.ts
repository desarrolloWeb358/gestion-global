import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp
} from "firebase/firestore";

import { db } from "@/firebase";

function colRef(clienteId: string) {
  return collection(db, `clientes/${clienteId}/notasInternasEjecutivo`);
}

export async function getNotasInternas(clienteId: string) {

  const q = query(colRef(clienteId), orderBy("fecha", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map(d => ({
    id: d.id,
    ...(d.data())
  }));

}

export async function addNotaInterna(clienteId: string, texto: string) {

  await addDoc(colRef(clienteId), {
    texto,
    fecha: serverTimestamp()
  });

}