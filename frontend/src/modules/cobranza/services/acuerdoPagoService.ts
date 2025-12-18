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
} from "firebase/firestore";
import { db } from "@/firebase";

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

  const ref = acuerdoId ? acuerdoDoc(clienteId, deudorId, acuerdoId) : doc(col);
  const id = ref.id;

  batch.set(ref, {
    ...acuerdo,
    id,
    estado: ACUERDO_ESTADO.BORRADOR,
    esActivo: false,
    actualizadoPor: userId ?? null,
    fechaActualizacion: serverTimestamp(),
    ...(acuerdoId ? {} : { creadoPor: userId ?? null, fechaCreacion: serverTimestamp() }),
  });

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

// ================= ACTIVAR EN FIRME (SIN tx.get(query)) =================
export async function activarAcuerdoEnFirme(
  clienteId: string,
  deudorId: string,
  acuerdoId: string,
  archivoFirmadoUrl: string,
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
    const ref = acuerdoDoc(clienteId, deudorId, acuerdoId);
    tx.update(ref, {
      estado: ACUERDO_ESTADO.EN_FIRME,
      esActivo: true,
      archivoFirmado: { url: archivoFirmadoUrl },
      fechaActualizacion: serverTimestamp(),
      actualizadoPor: userId ?? null,
    });
  });

  return true;
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

