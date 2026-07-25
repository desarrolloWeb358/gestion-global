// modules/cobranza/services/demandaService.ts
import { db } from "@/firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  serverTimestamp,
  orderBy,
  query,
  writeBatch,
} from "firebase/firestore";
import { registrarEliminacion } from "@/shared/services/auditLog/auditLogService";
import {
  Demanda,
  DemandadoDemanda,
  EtiquetaEnDemanda,
  ProcesoJudicialDemanda,
  calcularProximaAccion,
  toDateSafe,
} from "../models/demanda.model";
import { getDeudorById } from "./deudorService";

/* ============================================================
   CRUD Demandas
   Ruta: clientes/{clienteId}/deudores/{deudorId}/demandas/{demandaId}
   ============================================================ */

function demandasCol(clienteId: string, deudorId: string) {
  return collection(db, `clientes/${clienteId}/deudores/${deudorId}/demandas`);
}

function demandaDoc(clienteId: string, deudorId: string, demandaId: string) {
  return doc(db, `clientes/${clienteId}/deudores/${deudorId}/demandas/${demandaId}`);
}

// Convierte cualquier fecha (Date | Timestamp | ymd) a Timestamp para guardar; null preserva null.
function toTsOrNull(v: any): Timestamp | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const d = toDateSafe(v);
  return d ? Timestamp.fromDate(d) : null;
}

// Normaliza las fechas de notificaciones y etiquetas de un array de demandados/etiquetas.
function normalizarDemandadosParaGuardar(
  demandados: DemandadoDemanda[]
): DemandadoDemanda[] {
  return demandados
    .filter((d) => (d.nombre ?? "").trim())
    .map((d) => ({
      nombre: d.nombre.trim(),
      numeroDocumento: (d.numeroDocumento ?? "").trim(),
      notificaciones: (d.notificaciones ?? [])
        .filter((n) => n.tipo)
        .map((n) => ({
          tipo: n.tipo,
          fecha: toTsOrNull(n.fecha) ?? null,
          coteje: !!n.coteje,
        })),
    }));
}

function normalizarEtiquetasParaGuardar(
  etiquetas: EtiquetaEnDemanda[]
): EtiquetaEnDemanda[] {
  return etiquetas
    .filter((e) => (e.nombre ?? "").trim())
    .map((e) => ({
      ...(e.etiquetaId ? { etiquetaId: e.etiquetaId } : {}),
      nombre: e.nombre.trim(),
      detalle: (e.detalle ?? "").trim(),
      fecha: toTsOrNull(e.fecha) ?? null,
    }));
}

export async function getDemandas(
  clienteId: string,
  deudorId: string
): Promise<Demanda[]> {
  const snap = await getDocs(
    query(demandasCol(clienteId, deudorId), orderBy("fechaCreacion", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Demanda) }));
}

export async function getDemandaById(
  clienteId: string,
  deudorId: string,
  demandaId: string
): Promise<Demanda | null> {
  const snap = await getDoc(demandaDoc(clienteId, deudorId, demandaId));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as Demanda) }) : null;
}

export type DemandaInput = {
  numeroRadicado?: string;
  juzgado?: string;
  localidad?: string;
  demandaSustituto?: boolean;
  estado?: Demanda["estado"];
  demandados?: DemandadoDemanda[];
  etiquetas?: EtiquetaEnDemanda[];
  observacionesDemanda?: string;
  observacionesDemandaCliente?: string;
  fechaUltimaRevision?: any;
  procesoJudicial?: ProcesoJudicialDemanda;
};

export async function crearDemanda(
  clienteId: string,
  deudorId: string,
  data: DemandaInput
): Promise<string> {
  const deudor = await getDeudorById(clienteId, deudorId);
  const demandados = normalizarDemandadosParaGuardar(data.demandados ?? []);
  const etiquetas = normalizarEtiquetasParaGuardar(data.etiquetas ?? []);
  const proxima = calcularProximaAccion(etiquetas);

  const payload = {
    numeroRadicado: data.numeroRadicado?.trim() ?? "",
    juzgado: data.juzgado?.trim() ?? "",
    localidad: data.localidad?.trim() ?? "",
    demandaSustituto: !!data.demandaSustituto,
    estado: data.estado ?? "activa",
    demandados,
    etiquetas,
    proximaAccionFecha: proxima ? Timestamp.fromDate(proxima) : null,
    observacionesDemanda: data.observacionesDemanda ?? "",
    observacionesDemandaCliente: data.observacionesDemandaCliente ?? "",
    fechaUltimaRevision: toTsOrNull(data.fechaUltimaRevision) ?? null,
    ...(data.procesoJudicial ? { procesoJudicial: data.procesoJudicial } : {}),
    fechaCreacion: serverTimestamp(),
    fechaActualizacion: serverTimestamp(),
    // Denormalizados para el reporte global (collectionGroup)
    clienteId,
    deudorId,
    deudorNombre: deudor?.nombre ?? "",
    ubicacion: (deudor as any)?.ubicacion ?? "",
  };

  const ref = await addDoc(demandasCol(clienteId, deudorId), payload);
  return ref.id;
}

/** Actualiza los datos principales + demandados + etiquetas de una demanda. */
export async function actualizarDemanda(
  clienteId: string,
  deudorId: string,
  demandaId: string,
  data: DemandaInput
): Promise<void> {
  const next: Record<string, any> = { fechaActualizacion: serverTimestamp() };

  if (data.numeroRadicado !== undefined) next.numeroRadicado = data.numeroRadicado.trim();
  if (data.juzgado !== undefined) next.juzgado = data.juzgado.trim();
  if (data.localidad !== undefined) next.localidad = data.localidad.trim();
  if (data.demandaSustituto !== undefined) next.demandaSustituto = !!data.demandaSustituto;
  if (data.estado !== undefined) next.estado = data.estado;
  if (data.observacionesDemanda !== undefined) next.observacionesDemanda = data.observacionesDemanda;
  if (data.observacionesDemandaCliente !== undefined) next.observacionesDemandaCliente = data.observacionesDemandaCliente;
  if (data.fechaUltimaRevision !== undefined) next.fechaUltimaRevision = toTsOrNull(data.fechaUltimaRevision);
  if (data.procesoJudicial !== undefined) next.procesoJudicial = data.procesoJudicial;

  if (data.demandados !== undefined) {
    next.demandados = normalizarDemandadosParaGuardar(data.demandados);
  }
  if (data.etiquetas !== undefined) {
    const etiquetas = normalizarEtiquetasParaGuardar(data.etiquetas);
    next.etiquetas = etiquetas;
    const proxima = calcularProximaAccion(etiquetas);
    next.proximaAccionFecha = proxima ? Timestamp.fromDate(proxima) : null;
  }

  await updateDoc(demandaDoc(clienteId, deudorId, demandaId), next);
}

export async function actualizarEstadoDemanda(
  clienteId: string,
  deudorId: string,
  demandaId: string,
  estado: Demanda["estado"]
): Promise<void> {
  await updateDoc(demandaDoc(clienteId, deudorId, demandaId), {
    estado,
    fechaActualizacion: serverTimestamp(),
  });
}

/** Guarda el mapa procesoJudicial (monitoreo CPNU) de una demanda. */
export async function actualizarProcesoJudicialDemanda(
  clienteId: string,
  deudorId: string,
  demandaId: string,
  procesoJudicial: ProcesoJudicialDemanda
): Promise<void> {
  await updateDoc(demandaDoc(clienteId, deudorId, demandaId), { procesoJudicial });
}

/** Borra la demanda y toda su subcolección de seguimiento. */
export async function eliminarDemanda(
  clienteId: string,
  deudorId: string,
  demandaId: string
): Promise<void> {
  const ref = demandaDoc(clienteId, deudorId, demandaId);
  const snap = await getDoc(ref);
  const data = snap.exists() ? (snap.data() as Demanda) : null;

  // Borrar la subcolección de seguimiento en lotes
  const segCol = collection(db, `${ref.path}/seguimientoDemanda`);
  const segSnap = await getDocs(segCol);
  if (!segSnap.empty) {
    const batch = writeBatch(db);
    segSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  await deleteDoc(ref);
  await registrarEliminacion({
    modulo: "demanda",
    descripcion: data?.numeroRadicado || data?.juzgado || demandaId,
    coleccionPath: `clientes/${clienteId}/deudores/${deudorId}/demandas`,
  });
}
