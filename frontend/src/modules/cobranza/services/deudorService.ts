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
  Timestamp,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "../../../firebase";
import { Deudor } from "../models/deudores.model";
import { AcuerdoPago } from "../models/acuerdoPago.model";
import { EstadoMensual } from "../models/estadoMensual.model";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";

import type {
  DocumentReference,
  UpdateData,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { crearHistorialTipificacion } from "./historialTipificacionesService";

// ------------ Tipos DTO para crear/actualizar Deudor ------------

const TIPIFICACION_ORDER: Record<TipificacionDeuda, number> = {
  [TipificacionDeuda.GESTIONANDO]: 1,
  [TipificacionDeuda.DEMANDA]: 2,
  [TipificacionDeuda.ACUERDO]: 3,
  [TipificacionDeuda.DEMANDA_ACUERDO]: 4,

  // Estados NO operativos (van al final o se excluyen)
  [TipificacionDeuda.PREJURIDICO_INSOLVENCIA]: 90,
  [TipificacionDeuda.DEMANDA_INSOLVENCIA]: 91,
  [TipificacionDeuda.DEMANDA_TERMINADO]: 95,
  [TipificacionDeuda.DEVUELTO]: 98,
  [TipificacionDeuda.TERMINADO]: 99,
  [TipificacionDeuda.INACTIVO]: 0
};
export type DeudorCreateInput = {
  nombre: string;
  cedula?: string;
  ubicacion?: string;
  correos?: string[];
  telefonos?: string[];
  porcentajeHonorarios?: number;
  tipificacion?: TipificacionDeuda;
};
export type DeudorPatch = Partial<DeudorCreateInput>;

// ------------ Utilidades ------------
/*
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
  */

function toTimestampOrNull(v: unknown): Timestamp | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;

  if (v instanceof Date) return Timestamp.fromDate(v);

  // ya viene como Timestamp
  if (typeof v === "object" && v && "toDate" in (v as any)) return v as Timestamp;

  return undefined;
}


function normalizeTipificacion(input: unknown): TipificacionDeuda {
  const raw = String(input ?? "").trim();
  const lower = raw.toLowerCase();

  if ((Object.values(TipificacionDeuda) as string[]).includes(raw)) {
    return raw as TipificacionDeuda;
  }

  // primero casos específicos
  if (lower.includes("demanda") && lower.includes("terminad")) return TipificacionDeuda.DEMANDA_TERMINADO;
  if (lower.includes("demanda") && lower.includes("insolv")) return TipificacionDeuda.DEMANDA_INSOLVENCIA;
  if (lower.includes("demanda") && lower.includes("acuerdo")) return TipificacionDeuda.DEMANDA_ACUERDO;

  // demanda general
  if (lower.includes("demanda") || lower.includes("demandad")) return TipificacionDeuda.DEMANDA;

  // otros
  if (lower.includes("prejur") || lower.includes("pre-jur")) return TipificacionDeuda.PREJURIDICO_INSOLVENCIA;
  if (lower.includes("insolv")) return TipificacionDeuda.PREJURIDICO_INSOLVENCIA;
  if (lower.includes("acuerdo")) return TipificacionDeuda.ACUERDO;
  if (lower.includes("gestion")) return TipificacionDeuda.GESTIONANDO;
  if (lower.includes("devuelt")) return TipificacionDeuda.DEVUELTO;
  if (lower.includes("inactiv")) return TipificacionDeuda.INACTIVO;

  // terminado al final
  if (lower.includes("terminad")) return TipificacionDeuda.TERMINADO;

  return TipificacionDeuda.GESTIONANDO;
}



export async function borrarDeudorCompleto(clienteId: string, deudorId: string) {
  const user = getAuth().currentUser;
  if (!user) throw new Error("Debes iniciar sesión para eliminar.");


  const functions = getFunctions(app, "us-central1");
  const fn = httpsCallable(functions, "borrarDeudorCompleto");

  try {
    const { data } = await fn({ clienteId, deudorId });
    return data;
  } catch (e: any) {
    console.error("Callable error:", e?.code, e?.message, e?.details);
    throw new Error(e?.message || "No se pudo eliminar el deudor.");
  }
}


export function toMesId(fecha: string | Date) {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/*
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
  */

// ------------ Abonos / Cuotas ------------
/*
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
*/

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

// 🔧 FIX: Agregar porcentajeHonorarios al mapeo
export function mapDocToDeudor(id: string, data: DocumentData): Deudor {
  return {
    id,
    uidUsuario: data.uidUsuario ?? "",
    ubicacion: data.ubicacion ?? "",
    nombre: data.nombre ?? "",
    cedula: data.cedula ?? "",
    correos: Array.isArray(data.correos) ? data.correos : [],
    telefonos: Array.isArray(data.telefonos) ? data.telefonos : [],
    porcentajeHonorarios: data.porcentajeHonorarios ?? 15, // 🔧 AGREGADO: mapear porcentajeHonorarios desde Firestore
    acuerdoActivoId: data.acuerdoActivoId,
    juzgadoId: data.juzgadoId,
    numeroProceso: data.numeroProceso,
    anoProceso: data.anoProceso,
    tipificacion: normalizeTipificacion(data.tipificacion),
    demandaSustituto: data.demandaSustituto === true,
  };
}

export async function obtenerDeudorPorCliente(clienteId: string): Promise<Deudor[]> {
  const ref = collection(db, `clientes/${clienteId}/deudores`);
  const snap = await getDocs(ref);

  const deudores = snap.docs.map((d) => mapDocToDeudor(d.id, d.data()));

  // Si quieres: excluir solo INACTIVO a nivel backend (opcional)
  // return deudores.filter(d => d.tipificacion !== TipificacionDeuda.INACTIVO);

  // Mejor: no excluir nada, y que la UI decida
  return deudores.sort(
    (a, b) =>
      (TIPIFICACION_ORDER[a.tipificacion] ?? 50) -
      (TIPIFICACION_ORDER[b.tipificacion] ?? 50)
  );
}



// ------------ Ubicación: normalización y unicidad ------------

/**
 * La ubicación (inmueble) es la llave real del deudor dentro de la cartera, así que
 * SIEMPRE se guarda recortada y en minúsculas. Si se guardara tal cual la escribe
 * el usuario, "Apto 101" y "apto 101" quedarían como dos registros distintos y la
 * validación de duplicados —que compara por igualdad exacta— no los vería.
 */
export function normalizarUbicacion(ubicacion?: string): string {
  return (ubicacion ?? "").trim().toLowerCase();
}

/**
 * Busca el deudor que ya ocupa esa ubicación en la cartera, SIN filtrar por
 * tipificación: un inmueble con un deudor Terminado o Inactivo sigue ocupado.
 * `excluirDeudorId` evita que un deudor choque consigo mismo al editarse.
 */
async function buscarDeudorPorUbicacion(
  clienteId: string,
  ubicacionNormalizada: string,
  excluirDeudorId?: string
): Promise<Deudor | null> {
  const ref = collection(db, `clientes/${clienteId}/deudores`);
  const snapshot = await getDocs(
    query(ref, where("ubicacion", "==", ubicacionNormalizada))
  );

  const conflicto = snapshot.docs.find((d) => d.id !== excluirDeudorId);
  return conflicto ? mapDocToDeudor(conflicto.id, conflicto.data()) : null;
}

/**
 * El deudor que choca suele estar filtrado fuera de la tabla (Terminado, Inactivo,
 * Devuelto…), así que el mensaje dice quién es y en qué estado está; si no, el
 * error parece un fantasma.
 */
function mensajeUbicacionDuplicada(ubicacion: string, conflicto: Deudor): string {
  const nombre = conflicto.nombre?.trim() || "(sin nombre)";
  return (
    `No se puede usar la ubicación "${ubicacion}": ya la tiene ${nombre}, ` +
    `con tipificación ${conflicto.tipificacion}.`
  );
}

// ------------ Crear / Actualizar / Eliminar Deudor ------------
export async function crearDeudor(
  clienteId: string,
  data: DeudorCreateInput
): Promise<string> {

  const ref = collection(db, `clientes/${clienteId}/deudores`);

  const ubicacionNormalizada = normalizarUbicacion(data.ubicacion);

  if (!ubicacionNormalizada) {
    throw new Error("La ubicación es obligatoria.");
  }

  // 🔎 1️⃣ VALIDAR SI YA EXISTE (en toda la cartera, sin importar la tipificación)
  const conflicto = await buscarDeudorPorUbicacion(clienteId, ubicacionNormalizada);

  if (conflicto) {
    throw new Error(
      mensajeUbicacionDuplicada((data.ubicacion ?? "").trim(), conflicto)
    );
  }

  const tip = data.tipificacion ?? TipificacionDeuda.GESTIONANDO;

  const payload = {
    nombre: data.nombre,
    cedula: data.cedula ?? "",
    ubicacion: ubicacionNormalizada, // 👈 guardar normalizada
    correos: data.correos ?? [],
    telefonos: data.telefonos ?? [],
    porcentajeHonorarios: data.porcentajeHonorarios ?? 15,
    tipificacion: tip,
  };

  // 2️⃣ Crear deudor
  const docRef = await addDoc(ref, payload);
  const deudorId = docRef.id;

  // 3️⃣ Crear historial inicial
  await crearHistorialTipificacion(clienteId, deudorId, {
    fecha: Timestamp.now(),
    tipificacion: tip,
  });

  return deudorId;
}


export async function actualizarTipificacionDeudor(
  clienteId: string,
  deudorId: string,
  tipificacion: TipificacionDeuda
): Promise<void> {
  await updateDoc(doc(db, `clientes/${clienteId}/deudores/${deudorId}`), { tipificacion });
}

// Define el "shape" del documento en Firestore (lo que realmente guardas):
type DeudorDoc = {
  nombre: string;
  cedula: string;
  ubicacion: string;
  correos: string[];
  telefonos: string[];
  porcentajeHonorarios: number;
  tipificacion: TipificacionDeuda;
  acuerdoActivoId?: string;
  juzgadoId?: string;
  numeroProceso?: string;
  anoProceso?: string;
};

// Si tu DeudorCreateInput ya corresponde a estas claves, podrías usarla,
// pero DeudorDoc te da claridad de lo que vive en Firestore.

export async function actualizarDeudorDatos(
  clienteId: string,
  deudorId: string,
  patch: DeudorPatch
): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`) as DocumentReference<DeudorDoc>;

  const next: any = { ...patch };

  // La ubicación se normaliza y se valida igual que al crear: editar un deudor para
  // dejarle la ubicación de otro rompe la misma regla. Solo cuando el patch la trae
  // (los merges del import de Excel, por ejemplo, no la tocan y no pagan la lectura).
  if (patch.ubicacion !== undefined) {
    const ubicacionNormalizada = normalizarUbicacion(patch.ubicacion);

    if (!ubicacionNormalizada) {
      throw new Error("La ubicación es obligatoria.");
    }

    const conflicto = await buscarDeudorPorUbicacion(
      clienteId,
      ubicacionNormalizada,
      deudorId
    );

    if (conflicto) {
      throw new Error(mensajeUbicacionDuplicada(patch.ubicacion.trim(), conflicto));
    }

    next.ubicacion = ubicacionNormalizada;
  }

  const sanitized = Object.fromEntries(
    Object.entries(next).filter(([, v]) => v !== undefined)
  ) as UpdateData<DeudorDoc>;

  await updateDoc(ref, sanitized);
}


export async function eliminarDeudor(clienteId: string, deudorId: string) {
  await borrarDeudorCompleto(clienteId, deudorId);
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

/*
export async function obtenerAcuerdoActivo(
  clienteId: string,
  deudorId: string,
  acuerdoId: string
): Promise<AcuerdoPago | null> {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}/acuerdos/${acuerdoId}`);
  const snap = await getDoc(ref);
  return snap.exists() ? mapDocToAcuerdoPago(snap.id, snap.data()) : null;
}
*/

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

export async function vincularDeudorConUsuario(
  clienteId: string,
  deudorId: string,
  uidUsuario: string
) {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  await updateDoc(ref, { uidUsuario });
}

// Agrega teléfonos y correos a un deudor sin borrar los existentes (arrayUnion)
export async function mergeContactosDeudor(
  clienteId: string,
  deudorId: string,
  telefonos: string[],
  correos: string[]
): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
  const updates: Record<string, any> = {};
  if (telefonos.length > 0) updates.telefonos = arrayUnion(...telefonos);
  if (correos.length > 0) updates.correos = arrayUnion(...correos);
  if (Object.keys(updates).length > 0) await updateDoc(ref, updates);
}