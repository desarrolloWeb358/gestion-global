import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";

import { db, storage } from "@/firebase";
import { getAuth } from "firebase/auth";

import { ObservacionClienteGlobal } from "../models/observacionClienteGlobal.model";

function colRef(clienteId: string) {
  return collection(db, `clientes/${clienteId}/observacionesCliente`);
}

export async function getObservacionesClienteGlobal(
  clienteId: string
): Promise<ObservacionClienteGlobal[]> {

  const q = query(
    colRef(clienteId),
    orderBy("fecha", "desc")
  );

  const snap = await getDocs(q);

  return snap.docs.map(d => ({
    id: d.id,
    ...(d.data() as ObservacionClienteGlobal)
  }));
}

export async function addObservacionClienteGlobal(
  clienteId: string,
  texto: string,
  archivo?: File
) {

  const auth = getAuth();
  const usuarioId = auth.currentUser?.uid;

  let archivoUrl: string | undefined;
  let archivoNombre: string | undefined;

  if (archivo) {

    const storageRef = ref(
      storage,
      `clientes/${clienteId}/observacionesCliente/${Date.now()}_${archivo.name}`
    );

    await uploadBytes(storageRef, archivo);

    archivoUrl = await getDownloadURL(storageRef);
    archivoNombre = archivo.name;
  }

  await addDoc(colRef(clienteId), {
    texto,
    fecha: serverTimestamp(),
    archivoUrl,
    archivoNombre,
    usuarioId
  });
}