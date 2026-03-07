import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/firebase";
import { notificarUsuarioConAlertaYCorreo } from "@/modules/notificaciones/services/notificacionService";

export interface ObservacionDeudor {
  id?: string;
  texto: string;
  fecha?: Timestamp;
  archivoUrl?: string;
  archivoNombre?: string;
  usuarioId?: string;
}

function colRef(clienteId: string, deudorId: string) {
  return collection(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/observacionesDeudor`
  );
}

export async function getObservacionesDeudor(
  clienteId: string,
  deudorId: string
): Promise<ObservacionDeudor[]> {
  const q = query(colRef(clienteId, deudorId), orderBy("fecha", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ObservacionDeudor, "id">),
  }));
}

export async function addObservacionDeudor(
  clienteId: string,
  deudorId: string,
  texto: string,
  usuarioId: string,
  archivo?: File
): Promise<void> {
  let archivoUrl: string | undefined;
  let archivoNombre: string | undefined;

  if (archivo) {
    const storageRef = ref(
      storage,
      `clientes/${clienteId}/deudores/${deudorId}/observacionesDeudor/${Date.now()}_${archivo.name}`
    );
    await uploadBytes(storageRef, archivo);
    archivoUrl = await getDownloadURL(storageRef);
    archivoNombre = archivo.name;
  }

  await addDoc(colRef(clienteId, deudorId), {
    texto,
    fecha: serverTimestamp(),
    usuarioId,
    ...(archivoUrl && { archivoUrl, archivoNombre }),
  });

  // Notificar al ejecutivo prejurídico del cliente
  try {
    const clienteSnap = await getDoc(doc(db, "clientes", clienteId));
    if (!clienteSnap.exists()) return;

    const clienteData = clienteSnap.data() as any;
    const ejecutivoId: string | undefined = clienteData?.ejecutivoPrejuridicoId;
    if (!ejecutivoId || ejecutivoId === usuarioId) return;

    const nombreCliente: string = clienteData?.nombre || "Cliente";

    const deudorSnap = await getDoc(
      doc(db, `clientes/${clienteId}/deudores/${deudorId}`)
    );
    const nombreDeudor: string = deudorSnap.exists()
      ? (deudorSnap.data() as any)?.nombre || "Deudor"
      : "Deudor";

    await notificarUsuarioConAlertaYCorreo({
      usuarioId: ejecutivoId,
      modulo: "observacion_deudor",
      ruta: `/clientes/${clienteId}/deudores/${deudorId}/observacionesDeudor`,
      descripcionAlerta: `Nueva observación del deudor ${nombreDeudor} (${nombreCliente})`,
      nombreDestino: "",
      correoDestino: "",
      subject: "Nueva observación registrada por un deudor",
      tituloCorreo: "Observación de deudor",
      cuerpoHtmlCorreo: `
        <p>El deudor <strong>${nombreDeudor}</strong> del conjunto <strong>${nombreCliente}</strong> ha registrado una nueva observación.</p>
        <p style="margin-top:12px;padding:12px;border-radius:6px;background:#f3f4f6;font-style:italic;">"${texto}"</p>
        <p style="margin-top:12px;">Ingresa a la plataforma para revisar el detalle.</p>
      `,
    });
  } catch (err) {
    console.error("[addObservacionDeudor] Error notificando al ejecutivo:", err);
  }
}

export async function updateObservacionDeudor(
  clienteId: string,
  deudorId: string,
  obsId: string,
  nuevoTexto: string
): Promise<void> {
  const docRef = doc(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/observacionesDeudor/${obsId}`
  );
  await updateDoc(docRef, { texto: nuevoTexto });
}
