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
  deleteField,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { Seguimiento, TipoSeguimiento } from "../models/seguimiento.model";

/* ======================================================
   PRE-JURÍDICO
   Colección: clientes/{clienteId}/deudores/{deudorId}/seguimiento
   ====================================================== */

export async function getSeguimientos(
  clienteId: string,
  deudorId: string
): Promise<Seguimiento[]> {
  const refCol = collection(db, `clientes/${clienteId}/deudores/${deudorId}/seguimiento`);
  const snap = await getDocs(refCol);

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Seguimiento),
  }));
}

export async function addSeguimiento(
  clienteId: string,
  deudorId: string,
  data: Omit<Seguimiento, "id">,
  archivo?: File
) {
  let archivoUrl: string | undefined;

  if (archivo) {
    const sref = ref(storage, `clientes/${clienteId}/deudores/${deudorId}/seguimientos/${Date.now()}_${archivo.name}`);
    const snap = await uploadBytes(sref, archivo);
    archivoUrl = await getDownloadURL(snap.ref);
  }

  const refCol = collection(db, `clientes/${clienteId}/deudores/${deudorId}/seguimiento`);

  return addDoc(refCol, {
    ...data,
    fecha: data.fecha ?? Timestamp.now(),
    ...(archivoUrl ? { archivoUrl } : {}),
  });
}

export async function updateSeguimiento(
  clienteId: string,
  deudorId: string,
  seguimientoId: string,
  data: Omit<Seguimiento, "id">,
  archivo?: File,
  reemplazar?: boolean
) {
  const refDoc = doc(db, `clientes/${clienteId}/deudores/${deudorId}/seguimiento/${seguimientoId}`);

  let archivoUrl = data.archivoUrl;

  if (archivo && reemplazar) {
    if (data.archivoUrl) {
      try {
        const path = data.archivoUrl.startsWith("http")
          ? decodeURIComponent(data.archivoUrl.split("/o/")[1].split("?")[0])
          : data.archivoUrl;
        await deleteObject(ref(storage, path));
      } catch (err) {
        console.warn("Error al eliminar archivo previo:", err);
      }
    }
                            
    const sref = ref(storage, `clientes/${clienteId}/deudores/${deudorId}/seguimientos/${Date.now()}_${archivo.name}`);
    const snap = await uploadBytes(sref, archivo);
    archivoUrl = await getDownloadURL(snap.ref);
  }

  return updateDoc(refDoc, {
    ...data,
    archivoUrl: archivoUrl ?? deleteField(),
  });
}

export async function deleteSeguimiento(
  clienteId: string,
  deudorId: string,
  seguimientoId: string
) {
  const refDoc = doc(db, `clientes/${clienteId}/deudores/${deudorId}/seguimiento/${seguimientoId}`);
  return deleteDoc(refDoc);
}

/* ======================================================
   JURÍDICO
   Colección: clientes/{clienteId}/deudores/{deudorId}/seguimientoJuridico
   ====================================================== */

export async function getSeguimientosJuridico(
  clienteId: string,
  deudorId: string
): Promise<Seguimiento[]> {
  const refCol = collection(db, `clientes/${clienteId}/deudores/${deudorId}/seguimientoJuridico`);
  const snap = await getDocs(refCol);

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Seguimiento),
  }));
}

export async function addSeguimientoJuridico(
  clienteId: string,
  deudorId: string,
  data: Omit<Seguimiento, "id">,
  archivo?: File
) {
  let archivoUrl: string | undefined;

  if (archivo) {
    
    const sref = ref(storage, `clientes/${clienteId}/deudores/${deudorId}/seguimientos/${Date.now()}_${archivo.name}`);
    const snap = await uploadBytes(sref, archivo);
    archivoUrl = await getDownloadURL(snap.ref);
  }

  const refCol = collection(db, `clientes/${clienteId}/deudores/${deudorId}/seguimientoJuridico`);

  return addDoc(refCol, {
    ...data,
    fecha: data.fecha ?? Timestamp.now(),
    ...(archivoUrl ? { archivoUrl } : {}),
  });
}

export async function updateSeguimientoJuridico(
  clienteId: string,
  deudorId: string,
  seguimientoId: string,
  data: Omit<Seguimiento, "id">,
  archivo?: File,
  reemplazar?: boolean
) {
  const refDoc = doc(db, `clientes/${clienteId}/deudores/${deudorId}/seguimientoJuridico/${seguimientoId}`);

  let archivoUrl = data.archivoUrl;

  if (archivo && reemplazar) {
    if (data.archivoUrl) {
      try {
        const path = data.archivoUrl.startsWith("http")
          ? decodeURIComponent(data.archivoUrl.split("/o/")[1].split("?")[0])
          : data.archivoUrl;
        await deleteObject(ref(storage, path));
      } catch (err) {
        console.warn("Error al eliminar archivo previo (jurídico):", err);
      }
    }

    const sref = ref(storage, `clientes/${clienteId}/deudores/${deudorId}/seguimientos/${Date.now()}_${archivo.name}`);
    const snap = await uploadBytes(sref, archivo);
    archivoUrl = await getDownloadURL(snap.ref);
  }

  return updateDoc(refDoc, {
    ...data,
    archivoUrl: archivoUrl ?? deleteField(),
  });
}

export async function deleteSeguimientoJuridico(
  clienteId: string,
  deudorId: string,
  seguimientoId: string
) {
  const refDoc = doc(db, `clientes/${clienteId}/deudores/${deudorId}/seguimientoJuridico/${seguimientoId}`);
  return deleteDoc(refDoc);
}
