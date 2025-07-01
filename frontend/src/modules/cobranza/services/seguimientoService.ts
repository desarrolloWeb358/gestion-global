// src/modules/cobranza/services/seguimientoService.ts
import { db, storage } from "../../../firebase";
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc, doc, Timestamp
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
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

  const seguimientoData: any = {
    ...data,
    fecha: data.fecha ?? Timestamp.now(),
  };

  if (archivoUrl) {
    seguimientoData.archivoUrl = archivoUrl;
  }

  return await addDoc(refSeg, seguimientoData);

  
};

export const updateSeguimiento = async (
  clienteId: string,
  inmuebleId: string,
  seguimientoId: string,
  data: Omit<Seguimiento, 'id'>,
  archivo?: File,
  reemplazar?: boolean
) => {
  const refDoc = doc(db, `clientes/${clienteId}/inmuebles/${inmuebleId}/seguimiento/${seguimientoId}`);

  let archivoUrl = data.archivoUrl ?? "";

  // Si se quiere reemplazar el archivo y hay uno nuevo
  if (archivo && reemplazar) {
    // Eliminar archivo anterior si existe
    if (data.archivoUrl) {
      try {
        const anteriorRef = ref(storage, data.archivoUrl);
        await deleteObject(anteriorRef);
      } catch (error) {
        console.warn("Error al eliminar archivo anterior:", error);
      }
    }

    // Subir nuevo archivo
    const storageRef = ref(storage, `seguimientos/${clienteId}/${inmuebleId}/${Date.now()}_${archivo.name}`);
    const snap = await uploadBytes(storageRef, archivo);
    archivoUrl = await getDownloadURL(snap.ref);
  }

  const updatedData: Partial<Seguimiento> = {
    ...data,
    archivoUrl,
  };

  return await updateDoc(refDoc, updatedData);
};

export const deleteSeguimiento = async (
  clienteId: string,
  inmuebleId: string,
  seguimientoId: string
) => {
  const refDoc = doc(db, `clientes/${clienteId}/inmuebles/${inmuebleId}/seguimiento/${seguimientoId}`);
  return await deleteDoc(refDoc);
};
