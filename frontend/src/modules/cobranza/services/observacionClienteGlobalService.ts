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

  /* ================================
     DETERMINAR DESTINATARIO
  ================================= */

  // Cuando el cliente escribe → notificar al ejecutivo pre-jurídico asignado.
  // Cuando el ejecutivo escribe → notificar al cliente (su uid = id del documento).
  const destinatarioId: string | undefined =
    rol === "cliente"
      ? (clienteData?.ejecutivoPrejuridicoId ?? undefined)
      : clienteSnap.id;

  const descripcion =
    rol === "cliente"
      ? "Nuevo mensaje del cliente en seguimiento del conjunto"
      : "Nuevo mensaje del ejecutivo en seguimiento del conjunto";

  /* ================================
     EVITAR NOTIFICARSE A SÍ MISMO
  ================================= */

  if (!destinatarioId || destinatarioId === usuarioId) return;

  const ruta = `/clientes/${clienteId}/seguimiento-conjunto`;

  if (rol === "ejecutivo") {
    // Ejecutivo escribe → alerta + correo al conjunto (cliente)
    // correoDestino vacío → el servicio busca el correo del destinatario en usuarios/{id}
    await notificarUsuarioConAlertaYCorreo({
      usuarioId: destinatarioId,
      modulo: "seguimiento",
      ruta,
      descripcionAlerta: descripcion,
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
    // Cliente (conjunto) escribe → solo alerta al ejecutivo, sin correo
    await notificarUsuarioConAlerta({
      usuarioId: destinatarioId,
      modulo: "seguimiento",
      ruta,
      descripcion,
    });
  }

}