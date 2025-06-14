import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  DocumentData,
} from "firebase/firestore";
import { db } from  "../../../firebase";
import { Inmueble } from "../models/inmueble.model";



// Referencia a la colección de inmuebles
//const inmueblesCol = collection(db, "inmuebles");

/**
 * Mapea los datos crudos de Firestore a la interfaz Inmueble
 */
function mapDocToInmueble(id: string, data: DocumentData): Inmueble {
  return {
  id,
  torre: data.torre,
  apartamento: data.apartamento,
  casa: data.casa,
  nombreResponsable: data.nombreResponsable || data.responsable || "",
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
  cedulaResponsable: data.cedulaResponsable || 0,
  correoResponsable: data.correoResponsable || "",
  telefonoResponsable: data.telefonoResponsable || ""
};
}

/**
 * Obtiene todos los inmuebles asociados a un cliente
 */
export async function obtenerInmueblesPorCliente(clienteId: string): Promise<Inmueble[]> {
  const ref = collection(db, `clientes/${clienteId}/inmuebles`);
  const snap = await getDocs(ref);
  return snap.docs.map(doc => mapDocToInmueble(doc.id, doc.data()));
}

/**
 * Crea un nuevo inmueble en Firestore
 */
export async function crearInmueble(clienteId: string, inmueble: Inmueble): Promise<void> {
  const ref = collection(db, `clientes/${clienteId}/inmuebles`);
  await addDoc(ref, inmueble);
}

export async function actualizarInmueble(clienteId: string, inmueble: Inmueble): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/inmuebles/${inmueble.id}`);
  const { id, ...rest } = inmueble;
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

export async function eliminarInmueble(clienteId: string, inmuebleId: string): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/inmuebles/${inmuebleId}`);
  await deleteDoc(ref);
}

export async function guardarAcuerdoPago(
  clienteId: string,
  inmuebleId: string,
  acuerdoPago: Inmueble["acuerdo_pago"]
): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/inmuebles/${inmuebleId}`);
  await updateDoc(ref, { acuerdo_pago: acuerdoPago });
}
export async function actualizarHonorarios(
  clienteId: string,
  inmuebleId: string,
  porcentajeHonorarios: number
): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/inmuebles/${inmuebleId}`);
  await updateDoc(ref, {
    'acuerdo_pago.porcentajeHonorarios': porcentajeHonorarios,
  });
}