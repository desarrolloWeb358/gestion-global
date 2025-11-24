// src/modules/cobranza/services/acuerdoPagoService.ts
import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp,
  Timestamp,
  updateDoc,
  getDoc
} from "firebase/firestore";
import { db } from "@/firebase";
import type { AcuerdoPago } from "../models/acuerdoPago.model";

export interface HistorialAcuerdoPago extends AcuerdoPago {
  historialId?: string;
  version: number;
  motivoCambio?: string;
  fechaGuardado: Timestamp;
  creadoPor?: string;
  estado?: "activo" | "cumplido" | "incumplido" | "cancelado";
}

export const guardarAcuerdoEnHistorial = async (
  clienteId: string,
  deudorId: string,
  acuerdo: AcuerdoPago,
  motivoCambio?: string,
  userId?: string
): Promise<void> => {
  const historialRef = collection(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/historialAcuerdos`
  );

  // Obtener el número de versión
  const historialDocs = await getDocs(historialRef);
  const version = historialDocs.size + 1;

  await addDoc(historialRef, {
    ...acuerdo,
    version,
    motivoCambio: motivoCambio || "Creación/actualización de acuerdo",
    fechaGuardado: serverTimestamp(),
    creadoPor: userId,
  });
};

export const obtenerHistorialAcuerdos = async (
  clienteId: string,
  deudorId: string
): Promise<HistorialAcuerdoPago[]> => {
  const historialRef = collection(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/historialAcuerdos`
  );

  const q = query(historialRef, orderBy("fechaGuardado", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      historialId: doc.id,
      ...data,
      fechaCreacion: data.fechaCreacion,
      fechaGuardado: data.fechaGuardado,
      cuotas: data.cuotas?.map((c: any) => ({
        ...c,
        fechaPago: c.fechaPago,
      })) || [],
    } as HistorialAcuerdoPago;
  });
};

export const guardarAcuerdoActual = async (
  clienteId: string,
  deudorId: string,
  acuerdo: AcuerdoPago
): Promise<void> => {
  const deudorRef = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  
  await updateDoc(deudorRef, {
    acuerdoPago: acuerdo,
    fechaActualizacion: serverTimestamp(),
  });
};

export const obtenerAcuerdoActual = async (
  clienteId: string,
  deudorId: string
): Promise<AcuerdoPago | null> => {
  const deudorRef = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  const deudorSnap = await getDoc(deudorRef);
  
  if (!deudorSnap.exists()) return null;
  
  const data = deudorSnap.data();
  return data.acuerdoPago || null;
};

// src/modules/cobranza/services/acuerdoPagoService.ts
// Añade esta función al servicio

export const cambiarEstadoAcuerdo = async (
  clienteId: string,
  deudorId: string,
  estado: "activo" | "cumplido" | "incumplido" | "cancelado",
  motivoCambio: string,
  userId?: string
): Promise<void> => {
  const deudorRef = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  const deudorSnap = await getDoc(deudorRef);
  
  if (!deudorSnap.exists()) {
    throw new Error("Deudor no encontrado");
  }

  const acuerdoActual = deudorSnap.data()?.acuerdoPago;
  
  if (!acuerdoActual) {
    throw new Error("No hay acuerdo de pago activo");
  }

  // Guardar en historial antes de cambiar el estado
  await guardarAcuerdoEnHistorial(
    clienteId,
    deudorId,
    acuerdoActual,
    `Cambio de estado a: ${estado}. ${motivoCambio}`,
    userId
  );

  // Actualizar el estado del acuerdo
  await updateDoc(deudorRef, {
    "acuerdoPago.estado": estado,
    fechaActualizacion: serverTimestamp(),
  });
};