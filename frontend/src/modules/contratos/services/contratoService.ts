import {
  collection, addDoc, getDocs, deleteDoc, doc,
  orderBy, query, serverTimestamp, limit,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/firebase";
import { Contrato, ArchivoContrato } from "../models/contrato.model";

function colRef(clienteId: string) {
  return collection(db, `clientes/${clienteId}/contratos`);
}

function docRef(clienteId: string, contratoId: string) {
  return doc(db, `clientes/${clienteId}/contratos/${contratoId}`);
}

function mapDoc(id: string, data: any): Contrato {
  return {
    id,
    titulo: data.titulo ?? "",
    descripcion: data.descripcion ?? "",
    archivos: Array.isArray(data.archivos) ? data.archivos : [],
    creadoPor: data.creadoPor,
    fechaCreacion: data.fechaCreacion,
  };
}

export async function listarContratos(clienteId: string): Promise<Contrato[]> {
  const q = query(colRef(clienteId), orderBy("fechaCreacion", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDoc(d.id, d.data()));
}

export async function obtenerUltimoContrato(clienteId: string): Promise<Contrato | null> {
  const q = query(colRef(clienteId), orderBy("fechaCreacion", "desc"), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return mapDoc(d.id, d.data());
}

export async function crearContrato(
  clienteId: string,
  data: { titulo: string; descripcion?: string },
  archivos: File[],
  uid: string
): Promise<string> {
  const docCreado = await addDoc(colRef(clienteId), {
    titulo: data.titulo,
    descripcion: data.descripcion ?? "",
    archivos: [],
    creadoPor: uid,
    fechaCreacion: serverTimestamp(),
  });

  const contratoId = docCreado.id;

  if (archivos.length > 0) {
    const uploads = await Promise.all(
      archivos.map(async (archivo) => {
        const path = `clientes/${clienteId}/contratos/${contratoId}/${Date.now()}_${archivo.name}`;
        const sref = ref(storage, path);
        await uploadBytes(sref, archivo);
        const url = await getDownloadURL(sref);
        return { nombre: archivo.name, path, url } as ArchivoContrato;
      })
    );
    const { updateDoc } = await import("firebase/firestore");
    await updateDoc(docRef(clienteId, contratoId), { archivos: uploads });
  }

  return contratoId;
}

export async function eliminarContrato(clienteId: string, contrato: Contrato): Promise<void> {
  await Promise.all(
    (contrato.archivos ?? []).map((a) =>
      deleteObject(ref(storage, a.path)).catch(() => {})
    )
  );
  await deleteDoc(docRef(clienteId, contrato.id!));
}

