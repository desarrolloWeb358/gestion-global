// modules/casos/services/observacionCasoService.ts
//
// Hilo de observaciones del caso (cliente ↔ equipo).
// Ruta: clientesParticulares/{clienteId}/casos/{casoId}/observaciones/{id}
//
// El aviso por correo se reserva para el seguimiento (el avance real del caso);
// aquí basta la alerta interna, igual que en las observaciones de valores agregados.
import { db, storage } from "@/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { registrarEliminacion } from "@/shared/services/auditLog/auditLogService";
import { notificarUsuarioConAlerta } from "@/modules/notificaciones/services/notificacionService";
import type { AutorObservacion, ObservacionCaso } from "../models/observacionCaso.model";
import { casoPath, getCasoById } from "./casoService";
import { getClienteParticularById } from "./clienteParticularService";

function observacionesPath(clienteParticularId: string, casoId: string) {
  return `${casoPath(clienteParticularId, casoId)}/observaciones`;
}

export async function getObservacionesCaso(
  clienteParticularId: string,
  casoId: string
): Promise<ObservacionCaso[]> {
  const snap = await getDocs(
    query(
      collection(db, observacionesPath(clienteParticularId, casoId)),
      orderBy("fecha", "asc")
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ObservacionCaso) }));
}

export async function addObservacionCaso(
  clienteParticularId: string,
  casoId: string,
  texto: string,
  autor: { uid: string; nombre: string; rol: AutorObservacion },
  archivo?: File
): Promise<string> {
  let archivoPath: string | undefined;
  let archivoUrl: string | undefined;

  if (archivo) {
    archivoPath = `clientesParticulares/${clienteParticularId}/casos/${casoId}/observaciones/${Date.now()}_${archivo.name}`;
    const sref = ref(storage, archivoPath);
    await uploadBytes(sref, archivo);
    archivoUrl = await getDownloadURL(sref);
  }

  const payload: Omit<ObservacionCaso, "id"> = {
    texto: texto.trim(),
    fecha: Timestamp.now(),
    autorUid: autor.uid,
    autorNombre: autor.nombre,
    autorRol: autor.rol,
    ...(archivoPath ? { archivoPath } : {}),
    ...(archivoUrl ? { archivoUrl } : {}),
    ...(archivo ? { archivoNombre: archivo.name } : {}),
  };

  const created = await addDoc(
    collection(db, observacionesPath(clienteParticularId, casoId)),
    payload
  );

  try {
    await notificarContraparte(clienteParticularId, casoId, autor);
  } catch (err) {
    console.error("[addObservacionCaso] No se pudo notificar:", err);
  }

  return created.id;
}

/** Si escribe el cliente avisa al equipo asignado; si escribe el equipo avisa al cliente. */
async function notificarContraparte(
  clienteParticularId: string,
  casoId: string,
  autor: { nombre: string; rol: AutorObservacion }
): Promise<void> {
  const caso = await getCasoById(clienteParticularId, casoId);
  const referencia = caso?.titulo || caso?.numeroRadicado || caso?.tipoCaso || "un caso";

  if (autor.rol === "cliente") {
    const cliente = await getClienteParticularById(clienteParticularId);
    const destinatarios = [cliente?.abogadoId, cliente?.dependienteId].filter(
      (uid): uid is string => !!uid
    );
    await Promise.all(
      [...new Set(destinatarios)].map((uid) =>
        notificarUsuarioConAlerta({
          usuarioId: uid,
          modulo: "caso",
          ruta: `/clientes-particulares/${clienteParticularId}/casos/${casoId}`,
          descripcion: `${autor.nombre} dejó una observación en ${referencia}`,
        })
      )
    );
    return;
  }

  await notificarUsuarioConAlerta({
    usuarioId: clienteParticularId,
    modulo: "caso",
    ruta: `/mis-casos/${casoId}`,
    descripcion: `Nueva respuesta de Gestión Global en ${referencia}`,
  });
}

export async function deleteObservacionCaso(
  clienteParticularId: string,
  casoId: string,
  observacionId: string
): Promise<void> {
  const refDoc = doc(
    db,
    `${observacionesPath(clienteParticularId, casoId)}/${observacionId}`
  );
  const snap = await getDoc(refDoc);
  const data = snap.exists() ? (snap.data() as ObservacionCaso) : null;

  if (data?.archivoPath) {
    try {
      await deleteObject(ref(storage, data.archivoPath));
    } catch (e) {
      console.warn("No se pudo borrar el archivo de Storage:", e);
    }
  }

  await deleteDoc(refDoc);
  await registrarEliminacion({
    modulo: "observacionCaso",
    descripcion: data?.texto ?? observacionId,
    coleccionPath: observacionesPath(clienteParticularId, casoId),
  });
}
