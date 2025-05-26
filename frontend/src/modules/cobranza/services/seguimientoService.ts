// src/modules/cobranza/services/seguimientoService.ts
import { db, storage } from "../../../firebase";
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc, doc, Timestamp
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Seguimiento } from "../models/seguimiento.model";

export const getSeguimientos = async (
  clienteId: string,
  inmuebleId: string
): Promise<Seguimiento[]> => {
  const refSeg = collection(db, `clientes/${clienteId}/inmuebles/${inmuebleId}/seguimiento`);
  const snapshot = await getDocs(refSeg);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Seguimiento));
};

export const addSeguimiento = async (
  clienteId: string,
  inmuebleId: string,
  data: Omit<Seguimiento, 'id'>,
  archivo?: File
) => {
  let archivoUrl = "";

  if (archivo) {
    const storageRef = ref(storage, `seguimientos/${clienteId}/${inmuebleId}/${Date.now()}_${archivo.name}`);
    const snap = await uploadBytes(storageRef, archivo);
    archivoUrl = await getDownloadURL(snap.ref);
  }

  const refSeg = collection(db, `clientes/${clienteId}/inmuebles/${inmuebleId}/seguimiento`);
  return await addDoc(refSeg, {
    ...data,
    archivoUrl: archivoUrl || undefined,
    fecha: Timestamp.now(),
  });
};

export const updateSeguimiento = async (
  clienteId: string,
  inmuebleId: string,
  seguimientoId: string,
  data: Partial<Seguimiento>
) => {
  const refDoc = doc(db, `clientes/${clienteId}/inmuebles/${inmuebleId}/seguimiento/${seguimientoId}`);
  return await updateDoc(refDoc, data);
};

export const deleteSeguimiento = async (
  clienteId: string,
  inmuebleId: string,
  seguimientoId: string
) => {
  const refDoc = doc(db, `clientes/${clienteId}/inmuebles/${inmuebleId}/seguimiento/${seguimientoId}`);
  return await deleteDoc(refDoc);
};
