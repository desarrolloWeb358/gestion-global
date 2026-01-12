// src/modules/cobranza/services/acuerdoPagoService.ts
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { db, storage } from "@/firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";


import type { AcuerdoPago, CuotaAcuerdo } from "../models/acuerdoPago.model";
import { ACUERDO_ESTADO, normalizarEstadoAcuerdo } from "@/shared/constants/acuerdoEstado";

// ================= RUTAS =================
const acuerdosCol = (clienteId: string, deudorId: string) =>
  collection(db, `clientes/${clienteId}/deudores/${deudorId}/acuerdos`);

const acuerdoDoc = (clienteId: string, deudorId: string, acuerdoId: string) =>
  doc(db, `clientes/${clienteId}/deudores/${deudorId}/acuerdos/${acuerdoId}`);

const cuotasCol = (clienteId: string, deudorId: string, acuerdoId: string) =>
  collection(db, `clientes/${clienteId}/deudores/${deudorId}/acuerdos/${acuerdoId}/cuotas`);

// ================= OBTENER ACUERDO ACTUAL =================
export async function obtenerAcuerdoActual(clienteId: string, deudorId: string) {
  const col = acuerdosCol(clienteId, deudorId);

  // EN FIRME activo
  const qActivo = query(
    col,
    where("estado", "==", ACUERDO_ESTADO.EN_FIRME),
    where("esActivo", "==", true),
    limit(1)
  );

  const snapActivo = await getDocs(qActivo);
  if (!snapActivo.empty) {
    const docSnap = snapActivo.docs[0];
    const acuerdo = docSnap.data() as AcuerdoPago;

    const estado = normalizarEstadoAcuerdo(acuerdo.estado);
    if (estado !== acuerdo.estado) {
      await updateDoc(docSnap.ref, { estado });
      acuerdo.estado = estado;
    }

    return { acuerdo, acuerdoId: docSnap.id };
  }

  // BORRADOR más reciente
  const qBorrador = query(
    col,
    where("estado", "==", ACUERDO_ESTADO.BORRADOR),
    orderBy("fechaActualizacion", "desc"),
    limit(1)
  );

  const snapBorr = await getDocs(qBorrador);
  if (!snapBorr.empty) {
    const docSnap = snapBorr.docs[0];
    const acuerdo = docSnap.data() as AcuerdoPago;
    return { acuerdo, acuerdoId: docSnap.id };
  }

  return { acuerdo: null, acuerdoId: null };
}

// ================= GUARDAR BORRADOR =================
export async function guardarBorrador(
  clienteId: string,
  deudorId: string,
  acuerdo: Omit<AcuerdoPago, "id" | "fechaCreacion" | "fechaActualizacion">,
  cuotas: CuotaAcuerdo[],
  userId?: string,
  acuerdoId?: string
) {
  const batch = writeBatch(db);
  const col = acuerdosCol(clienteId, deudorId);

  const refDoc = acuerdoId ? acuerdoDoc(clienteId, deudorId, acuerdoId) : doc(col);
  const id = refDoc.id;

  batch.set(refDoc, {
    ...acuerdo,
    id,
    estado: ACUERDO_ESTADO.BORRADOR,
    esActivo: false,
    actualizadoPor: userId ?? null,
    fechaActualizacion: serverTimestamp(),
    ...(acuerdoId ? {} : { creadoPor: userId ?? null, fechaCreacion: serverTimestamp() }),
  },
    { merge: true }
  );

  const cuotasRef = cuotasCol(clienteId, deudorId, id);

  // borrar previas
  const prev = await getDocs(cuotasRef);
  prev.docs.forEach((d) => batch.delete(d.ref));

  // escribir nuevas
  cuotas.forEach((c) => {
    const cid = String(c.numero).padStart(3, "0");
    batch.set(doc(cuotasRef, cid), c);
  });

  await batch.commit();
  return { acuerdoId: id };
}



// ================= SUBIR PDF FIRMADO A STORAGE (REEMPLAZABLE) =================
export async function subirAcuerdoFirmadoPdf(params: {
  clienteId: string;
  deudorId: string;
  acuerdoId: string;
  file: File;
}) {
  const { clienteId, deudorId, acuerdoId, file } = params;

  if (!file) throw new Error("Archivo no válido");

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) throw new Error("El archivo debe ser PDF");

  // ✅ Ruta fija: si subes de nuevo, reemplaza el mismo archivo (lo que quieres)
  const path = `clientes/${clienteId}/deudores/${deudorId}/acuerdos/${acuerdoId}/acuerdo_firmado.pdf`;

  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, { contentType: "application/pdf" });
  const url = await getDownloadURL(storageRef);

  return {
    url,
    path,
    nombre: file.name,
    size: file.size,
    mime: file.type || "application/pdf",
  };
}

// ================= GUARDAR METADATA DEL PDF EN EL ACUERDO (SIGUE BORRADOR) =================
export async function guardarAcuerdoFirmadoBorrador(
  clienteId: string,
  deudorId: string,
  acuerdoId: string,
  data: {
    acuerdoURL: string;
    acuerdoPath?: string;
    acuerdoNombre?: string;
    acuerdoSize?: number;
    acuerdoMime?: string;
  },
  userId?: string
) {
  const refDoc = acuerdoDoc(clienteId, deudorId, acuerdoId);

  await updateDoc(refDoc, {
    acuerdoURL: data.acuerdoURL,
    acuerdoPath: data.acuerdoPath ?? null,
    acuerdoNombre: data.acuerdoNombre ?? null,
    acuerdoSize: data.acuerdoSize ?? null,
    acuerdoMime: data.acuerdoMime ?? null,

    // se queda en BORRADOR (no cambiamos estado aquí)
    fechaActualizacion: serverTimestamp(),
    actualizadoPor: userId ?? null,
  });

  return true;
}

// ================= FLUJO: SUBIR PDF + GUARDAR EN FIRESTORE (REEMPLAZABLE) =================
export async function subirYGuardarPdfFirmadoBorrador(params: {
  clienteId: string;
  deudorId: string;
  acuerdoId: string;
  file: File;
  userId?: string;
}) {
  const { clienteId, deudorId, acuerdoId, file, userId } = params;

  const up = await subirAcuerdoFirmadoPdf({ clienteId, deudorId, acuerdoId, file });

  await guardarAcuerdoFirmadoBorrador(
    clienteId,
    deudorId,
    acuerdoId,
    {
      acuerdoURL: up.url,
      acuerdoPath: up.path,
      acuerdoNombre: up.nombre,
      acuerdoSize: up.size,
      acuerdoMime: up.mime,
    },
    userId
  );

  return up; // {url,path,nombre,size,mime}
}


// ================= ACTIVAR EN FIRME (GUARDA acuerdoURL) =================
export async function activarAcuerdoEnFirme(
  clienteId: string,
  deudorId: string,
  acuerdoId: string,
  acuerdoURL: string,
  userId?: string
) {
  const col = acuerdosCol(clienteId, deudorId);

  // 1) buscar el EN_FIRME activo FUERA de la transacción
  const qActivo = query(
    col,
    where("estado", "==", ACUERDO_ESTADO.EN_FIRME),
    where("esActivo", "==", true),
    limit(1)
  );

  const snapActivo = await getDocs(qActivo);
  const prevActivoRef = snapActivo.empty ? null : snapActivo.docs[0].ref;

  // 2) transacción solo con DocumentReference
  await runTransaction(db, async (tx) => {
    // desactivar anterior si existe
    if (prevActivoRef) {
      tx.update(prevActivoRef, {
        estado: ACUERDO_ESTADO.CERRADO,
        esActivo: false,
        fechaActualizacion: serverTimestamp(),
        actualizadoPor: userId ?? null,
      });
    }

    // activar este
    const refDoc = acuerdoDoc(clienteId, deudorId, acuerdoId);
    tx.update(refDoc, {
      estado: ACUERDO_ESTADO.EN_FIRME,
      esActivo: true,

      // ✅ como pediste:
      acuerdoURL,

      fechaActualizacion: serverTimestamp(),
      actualizadoPor: userId ?? null,
    });
  });

  return true;
}

// ================= FLUJO COMPLETO: SUBIR PDF + PASAR A EN FIRME =================
export async function firmarAcuerdoConPdf(params: {
  clienteId: string;
  deudorId: string;
  acuerdoId: string;
  file: File;
  userId?: string;
}) {
  const { clienteId, deudorId, acuerdoId, file, userId } = params;

  // 1) sube el pdf
  const { url } = await subirAcuerdoFirmadoPdf({ clienteId, deudorId, acuerdoId, file });

  // 2) activa en firme guardando el url
  await activarAcuerdoEnFirme(clienteId, deudorId, acuerdoId, url, userId);

  return { url };
}

// ================= OBTENER CUOTAS =================
export async function obtenerCuotas(
  clienteId: string,
  deudorId: string,
  acuerdoId: string
): Promise<CuotaAcuerdo[]> {
  const col = collection(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/acuerdos/${acuerdoId}/cuotas`
  );

  const q = query(col, orderBy("numero", "asc"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => d.data() as CuotaAcuerdo);
}

export async function listarAcuerdos(clienteId: string, deudorId: string) {
  const col = acuerdosCol(clienteId, deudorId);

  const q = query(col, orderBy("fechaActualizacion", "desc"), limit(50));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function incumplirAcuerdoYCrearNuevoBorrador(params: {
  clienteId: string;
  deudorId: string;
  acuerdoIdEnFirme: string;
  userId?: string;
}) {
  const { clienteId, deudorId, acuerdoIdEnFirme, userId } = params;

  const refEnFirme = acuerdoDoc(clienteId, deudorId, acuerdoIdEnFirme);

  // 1) leer el acuerdo EN_FIRME actual
  const snapAcuerdo = await getDoc(refEnFirme);
  if (!snapAcuerdo.exists()) throw new Error("No se encontró el acuerdo EN FIRME");

  const acuerdoActual = snapAcuerdo.data() as any;

  // Validación: debe estar EN_FIRME
  if (acuerdoActual?.estado !== ACUERDO_ESTADO.EN_FIRME) {
    throw new Error("El acuerdo no está EN FIRME");
  }

  // 2) leer cuotas del acuerdo actual (para copiar como base del nuevo borrador)
  const cuotasActuales = await getDocs(cuotasCol(clienteId, deudorId, acuerdoIdEnFirme));
  const cuotasData = cuotasActuales.docs.map((d) => d.data() as any);

  // 3) crear el nuevo borrador (copiamos datos base, pero reseteamos archivo/activo/estado)
  const col = acuerdosCol(clienteId, deudorId);
  const nuevoRef = doc(col);
  const nuevoId = nuevoRef.id;

  const batch = writeBatch(db);

  // 3.1) marcar el actual como INCUMPLIDO y desactivarlo
  batch.update(refEnFirme, {
    estado: ACUERDO_ESTADO.INCUMPLIDO, // <- asegúrate que este estado existe en tu constante
    esActivo: false,
    fechaActualizacion: serverTimestamp(),
    actualizadoPor: userId ?? null,
  });

  // 3.2) nuevo borrador (copiamos lo que conviene y dejamos editable)
  batch.set(nuevoRef, {
    ...acuerdoActual,
    id: nuevoId,

    // estado nuevo
    estado: ACUERDO_ESTADO.BORRADOR,
    esActivo: false,

    // importante: no heredar pdf firmado del anterior
    acuerdoURL: "",
    acuerdoPath: null,
    acuerdoNombre: null,
    acuerdoSize: null,
    acuerdoMime: null,

    // auditoría
    creadoPor: userId ?? null,
    actualizadoPor: userId ?? null,
    fechaCreacion: serverTimestamp(),
    fechaActualizacion: serverTimestamp(),
  });

  // 3.3) copiar cuotas al nuevo borrador (para que arranque igual y puedas ajustar)
  const cuotasNuevaCol = cuotasCol(clienteId, deudorId, nuevoId);
  cuotasData.forEach((c: any) => {
    const cid = String(c.numero).padStart(3, "0");
    batch.set(doc(cuotasNuevaCol, cid), c);
  });

  await batch.commit();

  return { nuevoAcuerdoId: nuevoId };
}
