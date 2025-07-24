import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
} from "firebase/firestore";
import { db } from  "../../../firebase";
import { Cuota, deudor } from "../models/deudores.model";

export async function eliminarCuotas(clienteId: string, deudorId: string) {
  const ref = collection(db, `clientes/${clienteId}/deudores/${deudorId}/cuotas_acuerdo`);
  const snapshot = await getDocs(ref);

  const deletePromises = snapshot.docs.map((docSnap) =>
    deleteDoc(doc(db, ref.path, docSnap.id))
  );

  await Promise.all(deletePromises);
}

export async function guardarCuotasEnFirestore(
  deudorId: string,
  cuotas: Cuota[]
) {
  const batchErrors = [];

  for (const cuota of cuotas) {
    try {
     await addDoc(collection(db, "deudores", deudorId, "cuotas_acuerdo"), cuota);
    } catch (error) {
      console.error("Error guardando cuota:", cuota, error);
      batchErrors.push({ cuota, error });
    }
  }

  if (batchErrors.length > 0) {
    throw new Error("Algunas cuotas no se pudieron guardar");
  }
}

export const getDeudorById = async (
  clienteId: string,
  deudorId: string
): Promise<deudor | null> => {
  const refDoc = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  const snap = await getDoc(refDoc);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as deudor;
  }
  return null;
};

/**
 * Mapea los datos crudos de Firestore a la interfaz deudores
 */
function mapDocToDeudores(id: string, data: DocumentData): deudor {
  return {
    ubicacion: data.ubicacion || "",
  id,
  nombre: data.nombre || data || "",
  estado: data.estado,
  deuda_total: Number(data.deuda_total),
  correos: Array.isArray(data.correos) ? data.correos : [],
  telefonos: Array.isArray(data.telefonos) ? data.telefonos : [],
  acuerdo_pago: data.acuerdo_pago
    ? {
      numero: data.acuerdo_pago.numero,
      fecha_acuerdo: data.acuerdo_pago.fecha_acuerdo,
      caracteristicas: data.acuerdo_pago.caracteristicas,
      tipo: data.acuerdo_pago.tipo,
      valor_total_acordado: Number(data.acuerdo_pago.valor_total_acordado),
      cuotas: Array.isArray(data.acuerdo_pago.cuotas)
        ? data.acuerdo_pago.cuotas.map((c: any) => ({
          mes: c.mes,
          valor_esperado: Number(c.valor_esperado),
          fecha_limite: c.fecha_limite,
          observacion: c.observacion,
        }))
        : [],
    }
    : undefined,
  recaudos: data.recaudos || {},
  cedula: data.cedula || 0,
  tipificacion: data.tipificacion || "",
  clienteId: data.clienteId || "",
  ejecutivoId: data.ejecutivoId || "",
  
};
}

/**
 * Obtiene todos los deudores asociados a un cliente
 */
export async function obtenerDeudorPorCliente(clienteId: string): Promise<deudor[]> {
  const ref = collection(db, `clientes/${clienteId}/deudores`);
  const snap = await getDocs(ref);
  return snap.docs.map(doc => mapDocToDeudores(doc.id, doc.data()));
}

/**
 * Crea un nuevo deudor en Firestore
 */
export async function crearDeudor(clienteId: string, deudor: deudor): Promise<void> {
  const ref = collection(db, `clientes/${clienteId}/deudores`);
  await addDoc(ref, deudor);
}

export async function actualizarDeudor(clienteId: string, deudor: deudor): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudor.id}`);
  const { id, ...rest } = deudor;
  // Sanitize: remove undefined/null fields and ensure 'responsable' is always a string
  const sanitized: any = { ...rest };
  // Prefer 'nombreResponsable' for Firestore 'responsable' field
  if (sanitized.nombreResponsable !== undefined && sanitized.nombreResponsable !== null) {
    sanitized.responsable = sanitized.nombreResponsable;
  }
  // Remove fields with undefined/null values
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined || sanitized[key] === null) {
      delete sanitized[key];
    }
  });
  await updateDoc(ref, sanitized);
}

export async function eliminarDeudor(clienteId: string, deudorId: string): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  await deleteDoc(ref);
}

export async function guardarAcuerdoPago(
  clienteId: string,
  deudorId: string,
  acuerdoPago: deudor["acuerdo_pago"]
): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  await updateDoc(ref, { acuerdo_pago: acuerdoPago });
}
export async function actualizarHonorarios(
  clienteId: string,
  deudorId: string,
  porcentajeHonorarios: number
): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  await updateDoc(ref, {
    'acuerdo_pago.porcentajeHonorarios': porcentajeHonorarios,
  });
}