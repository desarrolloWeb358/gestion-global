// src/modules/cobranza/services/seguimientoService.ts
import { db, storage } from "../../../firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { Seguimiento, TipoSeguimiento } from "../models/seguimiento.model";

const tipoMap: Record<number, TipoSeguimiento> = {
  1: "llamada",
  2: "correo",
  3: "whatsapp",
  4: "sms",
  5: "visita",
  6: "otro",
};

export async function getSeguimientos(
  clienteId: string,
  deudorId: string
): Promise<Seguimiento[]> {
  const ref = collection(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/seguimiento`
  );
  const snap = await getDocs(ref);

  return snap.docs.map((doc) => {
    const data = doc.data() as Seguimiento;

    const rawTipo = (data as any).tipo;

    if (!data.tipoSeguimiento && typeof rawTipo === "number") {
      data.tipoSeguimiento = tipoMap[rawTipo] ?? "otro";
    }

    return {
      id: doc.id,
      ...data,
    };
  });
}

export const addSeguimiento = async (
  clienteId: string,
  deudorId: string,
  data: Omit<Seguimiento, "id">,
  archivo?: File
) => {
  let archivoUrl = "";

  if (archivo) {
    const storageRef = ref(
      storage,
      `seguimientos/${clienteId}/${deudorId}/${Date.now()}_${archivo.name}`
    );
    const snap = await uploadBytes(storageRef, archivo);
    archivoUrl = await getDownloadURL(snap.ref);
  }

  const refSeg = collection(
    db,
    `clientes/${clienteId}/inmuebles/${deudorId}/seguimiento`
  );

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
  deudorId: string,
  seguimientoId: string,
  data: Omit<Seguimiento, "id">,
  archivo?: File,
  reemplazar?: boolean
) => {
  const refDoc = doc(
    db,
    `clientes/${clienteId}/inmuebles/${deudorId}/seguimiento/${seguimientoId}`
  );

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
    const storageRef = ref(
      storage,
      `seguimientos/${clienteId}/${deudorId}/${Date.now()}_${archivo.name}`
    );
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
  deudorId: string,
  seguimientoId: string
) => {
  const refDoc = doc(
    db,
    `clientes/${clienteId}/inmuebles/${deudorId}/seguimiento/${seguimientoId}`
  );
  return await deleteDoc(refDoc);
};
