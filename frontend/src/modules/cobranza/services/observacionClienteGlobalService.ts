import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";


import { doc, getDoc } from "firebase/firestore";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";

import { db, storage } from "@/firebase";
import { getAuth } from "firebase/auth";

import { ObservacionClienteGlobal } from "../models/observacionClienteGlobal.model";
import { notificarUsuarioConAlertaYCorreo } from "@/modules/notificaciones/services/notificacionService";

function colRef(clienteId: string) {
  return collection(db, `clientes/${clienteId}/observacionesCliente`);
}

export async function getObservacionesClienteGlobal(
  clienteId: string
): Promise<ObservacionClienteGlobal[]> {

  const q = query(
    colRef(clienteId),
    orderBy("fecha", "asc")
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
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const usuarioId = user.uid;

  const rol = user.email?.includes("gestionglobal")
    ? "ejecutivo"
    : "cliente";

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

  const data: any = {
    texto,
    fecha: serverTimestamp() as any,
    usuarioId,
    rol
  };

  if (archivoUrl) {
    data.archivoUrl = archivoUrl;
    data.archivoNombre = archivoNombre;
  }

  await addDoc(colRef(clienteId), data);
  // Buscar ejecutivo del cliente
const clienteSnap = await getDoc(doc(db, "clientes", clienteId));

const ejecutivoId = clienteSnap.data()?.ejecutivoId;
const nombreEjecutivo = clienteSnap.data()?.nombreEjecutivo;
const correoEjecutivo = clienteSnap.data()?.correoEjecutivo;

if (ejecutivoId) {

  await notificarUsuarioConAlertaYCorreo({

    usuarioId: ejecutivoId,

    modulo: "seguimiento",

    ruta: `/clientes/${clienteId}/seguimiento-conjunto`,

    descripcionAlerta: "Nuevo mensaje del cliente en seguimiento del conjunto",

    nombreDestino: nombreEjecutivo || "Ejecutivo",

    correoDestino: correoEjecutivo || "",

    subject: "Nuevo mensaje del cliente",

    tituloCorreo: "Nuevo mensaje en seguimiento del conjunto",

    cuerpoHtmlCorreo: `
      <p>El cliente ha agregado un nuevo mensaje en el seguimiento del conjunto.</p>

      <p><strong>Mensaje:</strong></p>

      <p>${texto}</p>

      <p>
        Puedes revisarlo ingresando al sistema.
      </p>
    `
  });

}
}

