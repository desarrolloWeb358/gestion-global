import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  doc,
  getDoc
} from "firebase/firestore";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";

import { db, storage } from "@/firebase";
import { getAuth } from "firebase/auth"; // auth.currentUser aún necesario para usuarioId

import { ObservacionClienteGlobal } from "../models/observacionClienteGlobal.model";
import { notificarUsuarioConAlerta, notificarUsuarioConAlertaYCorreo } from "@/modules/notificaciones/services/notificacionService";


function colRef(clienteId: string) {
  return collection(db, `clientes/${clienteId}/observacionesCliente`);
}


/* ================================
   OBTENER MENSAJES
================================ */

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


/* ================================
   AGREGAR MENSAJE
================================ */

export async function addObservacionClienteGlobal(
  clienteId: string,
  texto: string,
  archivo?: File,
  esCliente?: boolean
) {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Usuario no autenticado");
  }

  const usuarioId = user.uid;

  const rol = esCliente ? "cliente" : "ejecutivo";


  /* ================================
     SUBIR ARCHIVO
  ================================= */

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

  /* ================================
     GUARDAR MENSAJE
  ================================= */

  const data: any = {
    texto,
    fecha: serverTimestamp(),
    usuarioId,
    rol,
  };

  if (archivoUrl) {
    data.archivoUrl = archivoUrl;
    data.archivoNombre = archivoNombre;
  }

  await addDoc(colRef(clienteId), data);

  /* ================================
     BUSCAR DATOS DEL CLIENTE
  ================================= */

  const clienteSnap = await getDoc(doc(db, "clientes", clienteId));

  if (!clienteSnap.exists()) return;

  const clienteData = clienteSnap.data();
  const nombreCliente: string = clienteData?.nombre?.trim() || "Cliente";

  const ruta = `/clientes/${clienteId}/seguimiento-conjunto`;

  if (rol === "ejecutivo") {
    /* ================================
       EJECUTIVO ESCRIBE → notificar al cliente (alerta + correo)
    ================================= */
    const destinatarioId: string = clienteSnap.id;
    if (destinatarioId === usuarioId) return;

    await notificarUsuarioConAlertaYCorreo({
      usuarioId: destinatarioId,
      modulo: "seguimiento",
      ruta,
      descripcionAlerta: `Nuevo mensaje del ejecutivo en seguimiento — ${nombreCliente}`,
      nombreDestino: "",
      correoDestino: "",
      subject: "Nuevo mensaje del ejecutivo en seguimiento del conjunto",
      tituloCorreo: "Nuevo mensaje en seguimiento del conjunto",
      cuerpoHtmlCorreo: `
        <p>El ejecutivo ha registrado un nuevo mensaje en el seguimiento del conjunto.</p>
        <p><strong>Mensaje:</strong></p>
        <p>${texto}</p>
        <br/>
        <p>Puedes revisarlo ingresando a la plataforma.</p>
      `,
    });
  } else {
    /* ================================
       CLIENTE ESCRIBE → notificar a ejecutiva prejurídica y jurídica
    ================================= */
    const descripcion = `Nuevo mensaje del cliente en seguimiento — ${nombreCliente}`;

    const destinatarios: string[] = [
      clienteData?.ejecutivoPrejuridicoId,
      clienteData?.ejecutivoJuridicoId,
    ].filter((id): id is string => !!id && id !== usuarioId);

    await Promise.all(
      destinatarios.map((uid) =>
        notificarUsuarioConAlerta({
          usuarioId: uid,
          modulo: "seguimiento",
          ruta,
          descripcion,
        })
      )
    );
  }

}