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

import { ArchivoObservacion, ObservacionClienteGlobal } from "../models/observacionClienteGlobal.model";
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

  return snap.docs.map(d => {
    const data = d.data() as any;
    // Fallback: si solo tiene campos planos (docs viejos), los convierte al array
    const archivos: ArchivoObservacion[] =
      data.archivos ??
      (data.archivoUrl
        ? [{ nombre: data.archivoNombre ?? "", path: "", url: data.archivoUrl }]
        : []);
    return {
      id: d.id,
      ...data,
      archivos,
    } as ObservacionClienteGlobal;
  });
}


/* ================================
   AGREGAR MENSAJE
================================ */

export async function addObservacionClienteGlobal(
  clienteId: string,
  texto: string,
  archivosFiles?: File[],
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
     SUBIR ARCHIVOS
  ================================= */

  let archivos: ArchivoObservacion[] = [];

  if (archivosFiles && archivosFiles.length > 0) {
    archivos = await Promise.all(
      archivosFiles.map(async (archivo) => {
        const path = `clientes/${clienteId}/observacionesCliente/${Date.now()}_${archivo.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, archivo);
        const url = await getDownloadURL(storageRef);
        return { nombre: archivo.name, path, url };
      })
    );
  }

  /* ================================
     GUARDAR MENSAJE
  ================================= */

  const data: any = {
    texto,
    fecha: serverTimestamp(),
    usuarioId,
    rol,
    archivos,
  };

  // Compatibilidad hacia atrás: primer archivo también en campos planos
  if (archivos.length > 0) {
    data.archivoUrl = archivos[0].url;
    data.archivoNombre = archivos[0].nombre;
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