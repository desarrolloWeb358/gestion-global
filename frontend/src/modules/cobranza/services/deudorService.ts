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
  setDoc,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { Deudor } from "../models/deudores.model";
import { Cuota, AcuerdoPago } from "../models/acuerdoPago.model";
import  { EstadoMensual } from "../models/estadoMensual.model";


/** Elige el porcentaje: usa el del estado mensual si existe; si no, toma el del deudor; si no, 0 */
export function resolverPorcentajeHonorarios(
  estado: Partial<EstadoMensual> | undefined,
  deudor: Partial<Deudor> | undefined
): number {
  const e = Number(estado?.porcentajeHonorarios);
  if (!isNaN(e) && e > 0) return e;

  const d = Number(deudor?.porcentajeHonorarios);
  if (!isNaN(d) && d > 0) return d;

  return 0;
}

export function toMesId(fecha: string | Date) {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

  export function calcularDeudaTotal(estadoMensual: EstadoMensual): {
    deuda: number;
    honorariosCalculados: number; // <- monto
    total: number;
  } {
    const deuda = isNaN(Number(estadoMensual.deuda)) ? 0 : Number(estadoMensual.deuda);
    const porcentaje = isNaN(Number(estadoMensual.porcentajeHonorarios)) // <- usa porcentajeHonorarios
      ? 0
      : Number(estadoMensual.porcentajeHonorarios);

    const honorariosCalculados = (deuda * porcentaje) / 100;
    const total = deuda + honorariosCalculados;

    return { deuda, honorariosCalculados, total };
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
  acuerdoActivoId: data.acuerdoActivoId,
  juzgadoId: data.juzgadoId,
  numeroProceso: data.numeroProceso,
  anoProceso: data.anoProceso,
  tipificacion: ""
};
}
export function mapDocToAcuerdoPago(id: string, data: DocumentData): AcuerdoPago {
  return {
    id,
    numero: data.numero ?? "",
    fechaCreacion: data.fechaCreacion,
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
  estadoMensual: EstadoMensual
): Promise<void> {
  const ref = collection(db, `clientes/${clienteId}/deudores`);
  const { honorariosCalculados, total } = calcularDeudaTotal(estadoMensual);

  await addDoc(ref, {
    ...estadoMensual,
    porcentajeHonorarios: Number(estadoMensual.honorarios) || 0,
    honorariosCalculados, // monto
    deudaTotal: total,
  });
}



export async function actualizarDeudor(
  clienteId: string,
  estadoMensual: EstadoMensual
): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/deudores/${estadoMensual.id}`);
  const { id, ...rest } = estadoMensual;

  const { honorariosCalculados, total } = calcularDeudaTotal(estadoMensual);

  const sanitized: any = {
    ...rest,
    porcentajeHonorarios: Number(rest.honorarios) || 0,
    honorariosCalculados, // monto
    deudaTotal: total,
  };

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
export async function actualizarHonorariosDeAcuerdo(
  clienteId: string,
  deudorId: string,
  acuerdoId: string,
  porcentajeHonorarios: number
): Promise<void> {
  const acuerdoRef = doc(
    db,
    `clientes/${clienteId}/deudores/${deudorId}/acuerdos/${acuerdoId}`
  );
  await updateDoc(acuerdoRef, { porcentajeHonorarios });
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


export async function crearEstadoMensual(
  clienteId: string,
  deudorId: string,
  estado: EstadoMensual,
  { overwrite = false }: { overwrite?: boolean } = {}
): Promise<void> {
  const mesId = estado.mes; // asegúrate de guardar "2025-06" etc.  (o usa toMesId(...))
  if (!/^\d{4}-\d{2}$/.test(mesId)) {
    throw new Error(`'mes' inválido: ${mesId}. Usa formato YYYY-MM`);
  }

  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales`, mesId);

  if (!overwrite) {
    const exists = await getDoc(ref);
    if (exists.exists()) throw new Error(`Ya existe un estado para ${mesId}`);
  }

  // setDoc permite usar merge para no borrar otros campos si actualizas
  await setDoc(ref, estado, { merge: overwrite });
}

export async function upsertEstadoMensual(
  clienteId: string,
  deudorId: string,
  estado: Partial<EstadoMensual> & { mes: string }
): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales`, estado.mes);
  await setDoc(ref, estado, { merge: true });
}

export async function getEstadoMensual(
  clienteId: string,
  deudorId: string,
  mes: string
): Promise<EstadoMensual | null> {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales`, mes);
  const snap = await getDoc(ref);
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as EstadoMensual) : null;
}

export async function listarEstadosMensuales(
  clienteId: string,
  deudorId: string
): Promise<EstadoMensual[]> {
  const col = collection(db, `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales`);
  const q = query(col, orderBy("mes", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as EstadoMensual));
}

