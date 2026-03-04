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
import { getAuth } from "firebase/auth";

import { ObservacionClienteGlobal } from "../models/observacionClienteGlobal.model";
import { notificarUsuarioConAlertaYCorreo } from "@/modules/notificaciones/services/notificacionService";


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
    orderBy("fecha", "asc")
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
    rol
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


  const ejecutivoId = clienteData?.ejecutivoId;
  const usuarioClienteId = clienteData?.usuarioClienteId;

  const nombreEjecutivo = clienteData?.nombreEjecutivo;
  const correoEjecutivo = clienteData?.correoEjecutivo;

  const nombreCliente = clienteData?.nombreCliente;
  const correoCliente = clienteData?.correoCliente;


  /* ================================
     DETERMINAR DESTINATARIO
  ================================= */

  let destinatarioId: string | undefined;
  let nombreDestino: string | undefined;
  let correoDestino: string | undefined;
  let descripcion: string;


  if (rol === "cliente") {

    destinatarioId = ejecutivoId;
    nombreDestino = nombreEjecutivo;
    correoDestino = correoEjecutivo;

    descripcion = "Nuevo mensaje del cliente en seguimiento del conjunto";

  } else {

    destinatarioId = usuarioClienteId;
    nombreDestino = nombreCliente;
    correoDestino = correoCliente;

    descripcion = "Nuevo mensaje del ejecutivo en seguimiento del conjunto";

  }


  /* ================================
     EVITAR NOTIFICARSE A SÍ MISMO
  ================================= */

  if (!destinatarioId || destinatarioId === usuarioId) return;


  /* ================================
     ENVIAR NOTIFICACIÓN
  ================================= */

  await notificarUsuarioConAlertaYCorreo({

    usuarioId: destinatarioId,

    modulo: "seguimiento",

    ruta: `/clientes/${clienteId}/seguimiento-conjunto`,

    descripcionAlerta: descripcion,

    nombreDestino: nombreDestino || "Usuario",

    correoDestino: correoDestino || "",

    subject: "Nuevo mensaje en seguimiento",

    tituloCorreo: "Nuevo mensaje en seguimiento del conjunto",

    cuerpoHtmlCorreo: `
      <p>Se ha agregado un nuevo mensaje en el seguimiento del conjunto.</p>

      <p><strong>Mensaje:</strong></p>

      <p>${texto}</p>

      <br/>

      <p>Puedes revisarlo ingresando a la plataforma.</p>
    `
  });

}