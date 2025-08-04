import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { Deudor } from "../models/deudores.model";
import { Cuota, AcuerdoPago } from "../models/acuerdoPago.model";


export function calcularDeudaTotal(deudor: Deudor): {
  deuda: number;
  honorarios: number;
  total: number;
} {
  const deuda = isNaN(Number(deudor.deuda)) ? 0 : Number(deudor.deuda);
  const porcentaje = isNaN(Number(deudor.porcentajeHonorarios)) ? 0 : Number(deudor.porcentajeHonorarios);
  const honorarios = (deuda * porcentaje) / 100;
  const total = deuda + honorarios;

  return { deuda, honorarios, total };
}
export async function eliminarCuotas(clienteId: string, deudorId: string) {
  const ref = collection(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/cuotas_acuerdo`
  );
  const snapshot = await getDocs(ref);

  const deletePromises = snapshot.docs.map((docSnap) =>
    deleteDoc(doc(db, ref.path, docSnap.id))
  );

  await Promise.all(deletePromises);
}

export async function guardarCuotasEnFirestore(deudorId: string, cuotas: Cuota[]) {
  const batchErrors = [];

  for (const cuota of cuotas) {
    try {
      await addDoc(
        collection(db, "deudores", deudorId, "cuotas_acuerdo"),
        cuota
      );
    } catch (error) {
      console.error("Error guardando cuota:", cuota, error);
      batchErrors.push({ cuota, error });
    }
  }

  if (batchErrors.length > 0) {
    throw new Error("Algunas cuotas no se pudieron guardar");
  }
}

export async function agregarAbonoAlDeudor(
  clienteId: string,
  deudorId: string,
  abono: {
    monto: number;
    fecha?: string;
    recibo?: string;
    tipo?: "ordinario" | "extraordinario" | "anticipo";
  }
) {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  return await updateDoc(ref, {
    abono: arrayUnion({
      ...abono,
      fecha: abono.fecha || new Date().toISOString(),
    }),
  });
}

export async function getDeudorById(clienteId: string, deudorId: string): Promise<Deudor | null> {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as Deudor;
  }
  return null;
}

/**
 * Mapea los datos crudos de Firestore a la interfaz deudores
 */
export function mapDocToDeudor(id: string, data: DocumentData): Deudor {
  return {
    id,
    ubicacion: data.ubicacion ?? "",
    nombre: data.nombre ?? "",
    cedula: data.cedula ?? "",
    correos: Array.isArray(data.correos) ? data.correos : [],
    telefonos: Array.isArray(data.telefonos) ? data.telefonos : [],
    estado: data.estado ?? "prejurídico",
    tipificacion: data.tipificacion ?? "",
    deuda: Number(data.deuda ?? 0),
    deudaTotal: Number(data.deudaTotal ?? 0),
    porcentajeHonorarios: Number(data.porcentajeHonorarios ?? 0),
    totalRecaudado: Number(data.totalRecaudado ?? 0),
    acuerdoActivoId: data.acuerdoActivoId,
    juzgadoId: data.juzgadoId,
    numeroProceso: data.numeroProceso,
    anoProceso: data.anoProceso,
  };
}
export function mapDocToAcuerdoPago(id: string, data: DocumentData): AcuerdoPago {
  return {
    id,
    numero: data.numero ?? "",
    fechaCreacion: data.fechaCreacion,
    tipo: data.tipo ?? "fijo",
    descripcion: data.descripcion ?? "",
    valorTotal: Number(data.valorTotal ?? 0),
    porcentajeHonorarios: Number(data.porcentajeHonorarios ?? 0),
    archivoUrl: data.archivoUrl,
    cuotas: Array.isArray(data.cuotas)
      ? data.cuotas.map((c: any) => ({
          numero: c.numero,
          fechaPago: c.fechaPago,
          valor: Number(c.valor),
          pagado: c.pagado,
          observacion: c.observacion,
        }))
      : [],
  };
}
/**
 * Obtiene todos los deudores asociados a un cliente
 */
export async function obtenerDeudorPorCliente(
  clienteId: string
): Promise<Deudor[]> {
  const ref = collection(db, `clientes/${clienteId}/deudores`);
  const snap = await getDocs(ref);
  return snap.docs.map((doc) => mapDocToDeudor(doc.id, doc.data()));
}

/**
 * Crea un nuevo deudor en Firestore
 */
export async function crearDeudor(
  clienteId: string,
  deudor: Deudor
): Promise<void> {
  const ref = collection(db, `clientes/${clienteId}/deudores`);

  const { total } = calcularDeudaTotal(deudor);

  await addDoc(ref, {
    ...deudor,
    deudaTotal: total,
  });
}



export async function actualizarDeudor(
  clienteId: string,
  deudor: Deudor
): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudor.id}`);
  const { id, ...rest } = deudor;

  const { total } = calcularDeudaTotal(deudor);

  const sanitized: any = {
    ...rest,
    deudaTotal: total, // ✅ actualiza automáticamente
  };

  // Elimina campos vacíos
  Object.keys(sanitized).forEach((key) => {
    if (sanitized[key] === undefined || sanitized[key] === null) {
      delete sanitized[key];
    }
  });

  await updateDoc(ref, sanitized);
}


export async function eliminarDeudor(
  clienteId: string,
  deudorId: string
): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  await deleteDoc(ref);
}

export async function guardarAcuerdoPorReferencia(
  clienteId: string,
  deudorId: string,
  acuerdo: AcuerdoPago
): Promise<string> {
  const acuerdosRef = collection(db, `clientes/${clienteId}/deudores/${deudorId}/acuerdos`);
  const docRef = await addDoc(acuerdosRef, acuerdo);

  const acuerdoId = docRef.id;

  const deudorRef = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  await updateDoc(deudorRef, { acuerdoActivoId: acuerdoId });

  

  return acuerdoId;
}
export async function actualizarHonorarios(
  clienteId: string,
  deudorId: string,
  porcentajeHonorarios: number
): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  await updateDoc(ref, {
    "AcuerdoPago.porcentajeHonorarios": porcentajeHonorarios,
  });
}

export async function guardarAcuerdoEnSubcoleccion(
  clienteId: string,
  deudorId: string,
  acuerdo: AcuerdoPago
): Promise<string> {
  const acuerdosRef = collection(db, `clientes/${clienteId}/deudores/${deudorId}/acuerdos`);
  const docRef = await addDoc(acuerdosRef, acuerdo);

  const acuerdoId = docRef.id;

  // Actualiza el campo acuerdoActivoId en el documento del deudor
  const deudorRef = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  await updateDoc(deudorRef, { acuerdoActivoId: acuerdoId });

  return acuerdoId;
}

export async function obtenerAcuerdoActivo(
  clienteId: string,
  deudorId: string,
  acuerdoId: string
): Promise<AcuerdoPago | null> {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}/acuerdos/${acuerdoId}`);
  const snap = await getDoc(ref);

  return snap.exists()
    ? mapDocToAcuerdoPago(snap.id, snap.data())
    : null;
}
