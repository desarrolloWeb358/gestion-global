import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  addDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/firebase";
import type {
  AcuerdoPago,
  CuotaAcuerdo,
  HistorialAcuerdoPago,
  EstadoAcuerdoPago,
} from "@/modules/cobranza/models/acuerdoPago.model";

const acuerdosCol = (clienteId: string, deudorId: string) =>
  collection(db, `clientes/${clienteId}/deudores/${deudorId}/acuerdos`);

const acuerdoDoc = (clienteId: string, deudorId: string, acuerdoId: string) =>
  doc(db, `clientes/${clienteId}/deudores/${deudorId}/acuerdos/${acuerdoId}`);

const cuotasCol = (clienteId: string, deudorId: string, acuerdoId: string) =>
  collection(db, `clientes/${clienteId}/deudores/${deudorId}/acuerdos/${acuerdoId}/cuotas`);

const historialCol = (clienteId: string, deudorId: string) =>
  collection(db, `clientes/${clienteId}/deudores/${deudorId}/historialAcuerdos`);

export async function crearAcuerdo(
  clienteId: string,
  deudorId: string,
  acuerdo: Omit<AcuerdoPago, "id" | "fechaCreacion" | "fechaActualizacion">,
  cuotas: CuotaAcuerdo[],
  motivo: string,
  userId?: string
) {
  const batch = writeBatch(db);

  const acuerdoRef = doc(acuerdosCol(clienteId, deudorId)); // auto-id
  const acuerdoId = acuerdoRef.id;

  batch.set(acuerdoRef, {
    ...acuerdo,
    creadoPor: userId || null,
    fechaCreacion: serverTimestamp(),
    actualizadoPor: userId || null,
    fechaActualizacion: serverTimestamp(),
  });

  // cuotas como docs: "001", "002" para orden natural
  cuotas.forEach((c) => {
    const cuotaId = String(c.numero).padStart(3, "0");
    const cuotaRef = doc(cuotasCol(clienteId, deudorId, acuerdoId), cuotaId);
    batch.set(cuotaRef, c);
  });

  // historial (version 1)
  const version = 1;
  const histRef = doc(historialCol(clienteId, deudorId));
  batch.set(histRef, {
    ...acuerdo,
    id: acuerdoId,
    version,
    motivoCambio: motivo || "Creación de acuerdo",
    fechaGuardado: serverTimestamp(),
    guardadoPor: userId || null,
  });

  await batch.commit();

  return { acuerdoId };
}

export async function actualizarAcuerdo(
  clienteId: string,
  deudorId: string,
  acuerdoId: string,
  acuerdo: Partial<AcuerdoPago>,
  cuotas: CuotaAcuerdo[],
  motivo: string,
  userId?: string
) {
  const batch = writeBatch(db);

  const acuerdoRef = acuerdoDoc(clienteId, deudorId, acuerdoId);

  // version historial: size + 1 (simple)
  const historialSnap = await getDocs(historialCol(clienteId, deudorId));
  const version = historialSnap.size + 1;

  // guardar snapshot a historial (con merge de lo actual + cambios)
  const actualSnap = await getDoc(acuerdoRef);
  const actual = actualSnap.exists() ? (actualSnap.data() as AcuerdoPago) : null;

  batch.set(doc(historialCol(clienteId, deudorId)), {
    ...(actual || {}),
    ...(acuerdo || {}),
    id: acuerdoId,
    version,
    motivoCambio: motivo || "Actualización de acuerdo",
    fechaGuardado: serverTimestamp(),
    guardadoPor: userId || null,
  });

  batch.update(acuerdoRef, {
    ...(acuerdo || {}),
    actualizadoPor: userId || null,
    fechaActualizacion: serverTimestamp(),
  });

  // Reescribir cuotas (simple y seguro para tu caso)
  cuotas.forEach((c) => {
    const cuotaId = String(c.numero).padStart(3, "0");
    const cuotaRef = doc(cuotasCol(clienteId, deudorId, acuerdoId), cuotaId);
    batch.set(cuotaRef, c);
  });

  await batch.commit();
}

export async function obtenerAcuerdo(
  clienteId: string,
  deudorId: string,
  acuerdoId: string
) {
  const snap = await getDoc(acuerdoDoc(clienteId, deudorId, acuerdoId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as AcuerdoPago) } as AcuerdoPago;
}

export async function obtenerCuotasAcuerdo(
  clienteId: string,
  deudorId: string,
  acuerdoId: string
) {
  const q = query(cuotasCol(clienteId, deudorId, acuerdoId), orderBy("numero", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as CuotaAcuerdo);
}

export async function listarAcuerdos(clienteId: string, deudorId: string) {
  const q = query(acuerdosCol(clienteId, deudorId), orderBy("fechaAcuerdo", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as AcuerdoPago) })) as AcuerdoPago[];
}

export async function obtenerHistorialAcuerdos(clienteId: string, deudorId: string) {
  const q = query(historialCol(clienteId, deudorId), orderBy("fechaGuardado", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ historialId: d.id, ...(d.data() as HistorialAcuerdoPago) }));
}

export async function cambiarEstadoAcuerdo(
  clienteId: string,
  deudorId: string,
  acuerdoId: string,
  nuevoEstado: EstadoAcuerdoPago,
  motivo: string,
  userId?: string
) {
  await actualizarAcuerdo(
    clienteId,
    deudorId,
    acuerdoId,
    { estado: nuevoEstado },
    [], // no toca cuotas aquí (pero puedes cargar y reenviar si quieres)
    `Cambio de estado a: ${nuevoEstado}. ${motivo}`,
    userId
  );

  // Nota: si quieres que NO se creen cuotas vacías al pasar cuotas=[],
  // en tu app llamas cambiarEstado con otra función que NO reescriba cuotas.
}
