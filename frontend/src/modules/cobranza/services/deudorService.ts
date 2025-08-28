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
import { EstadoMensual } from "../models/estadoMensual.model";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";

// ------------ Tipos DTO para crear/actualizar Deudor ------------
export type DeudorCreateInput = {
  nombre: string;
  cedula?: string;
  ubicacion?: string;
  correos?: string[];
  telefonos?: string[];
  estado?: string; // "prejurídico" | "jurídico" | ...
  tipificacion?: TipificacionDeuda;
};
export type DeudorPatch = Partial<DeudorCreateInput>;

// ------------ Utilidades ------------
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

function normalizeTipificacion(input: unknown): TipificacionDeuda {
  const v = String(input ?? "").trim();
  const map: Record<string, TipificacionDeuda> = {
    "gestionando": TipificacionDeuda.GESTIONANDO,
    "gestionando/": TipificacionDeuda.GESTIONANDO,
    "acuerdo": TipificacionDeuda.ACUERDO,
    "acuerdo de pago": TipificacionDeuda.ACUERDO,
    "demanda": TipificacionDeuda.DEMANDA,
    "demanda/acuerdo": TipificacionDeuda.DEMANDAACUERDO,
    "acuerdo demanda": TipificacionDeuda.DEMANDAACUERDO,
    "devuelto": TipificacionDeuda.DEVUELTO,
    "terminado": TipificacionDeuda.TERMINADO,
  };
  if ((Object.values(TipificacionDeuda) as string[]).includes(v)) return v as TipificacionDeuda;
  const lower = v.toLowerCase();
  return map[lower] ?? TipificacionDeuda.GESTIONANDO;
}

export function toMesId(fecha: string | Date) {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function calcularDeudaTotal(estadoMensual: EstadoMensual): {
  deuda: number;
  honorariosCalculados: number;
  total: number;
} {
  const deuda = isNaN(Number(estadoMensual.deuda)) ? 0 : Number(estadoMensual.deuda);
  const porcentaje = isNaN(Number(estadoMensual.porcentajeHonorarios))
    ? 0
    : Number(estadoMensual.porcentajeHonorarios);
  const honorariosCalculados = (deuda * porcentaje) / 100;
  const total = deuda + honorariosCalculados;
  return { deuda, honorariosCalculados, total };
}

// ------------ Abonos / Cuotas ------------
export async function guardarCuotasEnFirestore(deudorId: string, cuotas: Cuota[]) {
  // NOTE: Esta ruta no incluye clienteId; si tu estructura los anida por cliente, ajusta la ruta aquí.
  const batchErrors: Array<{ cuota: Cuota; error: unknown }> = [];
  for (const cuota of cuotas) {
    try {
      await addDoc(collection(db, "deudores", deudorId, "cuotas_acuerdo"), cuota);
    } catch (error) {
      console.error("Error guardando cuota:", cuota, error);
      batchErrors.push({ cuota, error });
    }
  }
  if (batchErrors.length > 0) throw new Error("Algunas cuotas no se pudieron guardar");
}

export async function agregarAbonoAlDeudor(
  clienteId: string,
  deudorId: string,
  abono: { monto: number; fecha?: string; recibo?: string }
) {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  return await updateDoc(ref, {
    abono: arrayUnion({
      ...abono,
      fecha: abono.fecha || new Date().toISOString(),
    }),
  });
}

// ------------ Lectura Deudor ------------
export async function getDeudorById(clienteId: string, deudorId: string): Promise<Deudor | null> {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: snap.id, ...snap.data() } as Deudor;
  return null;
}

export function mapDocToDeudor(id: string, data: DocumentData): Deudor {
  return {
    id,
    ubicacion: data.ubicacion ?? "",
    nombre: data.nombre ?? "",
    cedula: data.cedula ?? "",
    correos: Array.isArray(data.correos) ? data.correos : [],
    telefonos: Array.isArray(data.telefonos) ? data.telefonos : [],
    acuerdoActivoId: data.acuerdoActivoId,
    juzgadoId: data.juzgadoId,
    numeroProceso: data.numeroProceso,
    anoProceso: data.anoProceso,
    tipificacion: normalizeTipificacion(data.tipificacion),
  };
}

export async function obtenerDeudorPorCliente(clienteId: string): Promise<Deudor[]> {
  const ref = collection(db, `clientes/${clienteId}/deudores`);
  const snap = await getDocs(ref);
  return snap.docs.map((d) => mapDocToDeudor(d.id, d.data()));
}

// ------------ Crear / Actualizar / Eliminar Deudor ------------
export async function crearDeudor(clienteId: string, data: DeudorCreateInput): Promise<string> {
  const ref = collection(db, `clientes/${clienteId}/deudores`);
  const payload = {
    nombre: data.nombre,
    cedula: data.cedula ?? "",
    ubicacion: data.ubicacion ?? "",
    correos: data.correos ?? [],
    telefonos: data.telefonos ?? [],
    estado: data.estado ?? "prejurídico",
    tipificacion: data.tipificacion ?? TipificacionDeuda.GESTIONANDO,
  };
  const docRef = await addDoc(ref, payload);
  return docRef.id;
}

export async function actualizarTipificacionDeudor(
  clienteId: string,
  deudorId: string,
  tipificacion: TipificacionDeuda
): Promise<void> {
  await updateDoc(doc(db, `clientes/${clienteId}/deudores/${deudorId}`), { tipificacion });
}

export async function actualizarDeudorDatos(
  clienteId: string,
  deudorId: string,
  patch: DeudorPatch
): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  const sanitized: Record<string, unknown> = { ...patch };
  Object.keys(sanitized).forEach((k) => {
    if ((sanitized as any)[k] === undefined) delete (sanitized as any)[k];
  });
  await updateDoc(ref, sanitized);
}

export async function eliminarDeudor(clienteId: string, deudorId: string): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  await deleteDoc(ref);
}

// ------------ Acuerdos ------------
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
  const acuerdoRef = doc(db, `clientes/${clienteId}/deudores/${deudorId}/acuerdos/${acuerdoId}`);
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
  return snap.exists() ? mapDocToAcuerdoPago(snap.id, snap.data()) : null;
}

// ------------ Estados Mensuales (sin tipificación) ------------
export async function crearEstadoMensual(
  clienteId: string,
  deudorId: string,
  estado: EstadoMensual,
  { overwrite = false }: { overwrite?: boolean } = {}
): Promise<void> {
  const mesId = estado.mes;
  if (!/^\d{4}-\d{2}$/.test(mesId)) {
    throw new Error(`'mes' inválido: ${mesId}. Usa formato YYYY-MM`);
  }
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales`, mesId);
  if (!overwrite) {
    const exists = await getDoc(ref);
    if (exists.exists()) throw new Error(`Ya existe un estado para ${mesId}`);
  }
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
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EstadoMensual));
}
