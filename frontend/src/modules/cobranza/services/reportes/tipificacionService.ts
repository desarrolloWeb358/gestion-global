// src/modules/cobranza/services/reportes/tipificacionService.ts
import { db } from "@/firebase";
import { collection, getDocs, Timestamp, query, where, orderBy, limit } from "firebase/firestore";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";

export type TipificacionKey = TipificacionDeuda;

export interface PieItem {
  name: TipificacionKey;
  value: number;
}

export interface ResumenTipificacion {
  tipificacion: TipificacionKey;
  inmuebles: number;
  recaudoTotal: number;
  porRecuperar: number;
}

export interface DeudorTipificacionDetalle {
  deudorId: string;
  nombre: string;
  ubicacion: string;
  tipificacion: TipificacionKey;
  recaudoTotal: number;
  porRecuperar: number;
}

export const CATEGORIAS: TipificacionKey[] = [
  TipificacionDeuda.DEVUELTO,
  TipificacionDeuda.TERMINADO,
  TipificacionDeuda.ACUERDO,
  TipificacionDeuda.GESTIONANDO,
  TipificacionDeuda.DEMANDA,
  TipificacionDeuda.DEMANDA_ACUERDO,
  TipificacionDeuda.DEMANDA_TERMINADO,
  TipificacionDeuda.PREJURIDICO_INSOLVENCIA,
  TipificacionDeuda.DEMANDA_INSOLVENCIA,
];

const ES_CATEGORIA = new Set<TipificacionKey>(CATEGORIAS);
function isCategoriaValida(cat: any): cat is TipificacionKey {
  return ES_CATEGORIA.has(cat);
}

function toDateSafe(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "object" && typeof v.seconds === "number") return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function buildFechaCorte(year: number, month: number): Date {
  // month: 1..12
  // último día del mes a las 23:59:59.999
  return new Date(year, month, 0, 23, 59, 59, 999);
}

function isFinalTip(t: TipificacionDeuda) {
  return t === TipificacionDeuda.TERMINADO || t === TipificacionDeuda.DEMANDA_TERMINADO;
}

function inicioDentroDelAnio(inicio: Date | null, year: number) {
  if (!inicio) return false;
  const a = new Date(year, 0, 1);
  const b = new Date(year + 1, 0, 1);
  return inicio >= a && inicio < b;
}

async function getTipificacionEnFechaCorte(
  clienteId: string,
  deudorId: string,
  fechaCorte: Date,
  tipFallback?: TipificacionDeuda
): Promise<{ tipificacion: TipificacionDeuda; startDate: Date | null }> {
  const ref = collection(db, `clientes/${clienteId}/deudores/${deudorId}/historialTipificaciones`);

  const q = query(
    ref,
    where("fecha", "<=", Timestamp.fromDate(fechaCorte)),
    orderBy("fecha", "desc"),
    limit(1)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    return { tipificacion: tipFallback ?? TipificacionDeuda.GESTIONANDO, startDate: null };
  }

  const d = snap.docs[0].data() as { fecha?: any; tipificacion?: string };
  const startDate = toDateSafe(d.fecha);
  const tip = (d.tipificacion as TipificacionDeuda) ?? (tipFallback ?? TipificacionDeuda.GESTIONANDO);

  return { tipificacion: tip, startDate };
}

/**
 * Pie: cuenta tipificación "vigente" a una fecha (year+month).
 * TERMINADO / DEMANDA_TERMINADO: solo si la fecha de inicio de ese estado cae dentro del año consultado.
 */
export async function contarTipificacionPorCliente(
  clienteId: string,
  year: number,
  month: number
): Promise<PieItem[]> {
  const fechaCorte = buildFechaCorte(year, month);

  const ref = collection(db, `clientes/${clienteId}/deudores`);
  const snap = await getDocs(ref);

  const counts = new Map<TipificacionKey, number>();
  CATEGORIAS.forEach((c) => counts.set(c, 0));

  await Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data() as { tipificacion?: string };
      const tipFallback = (data.tipificacion as TipificacionDeuda) ?? TipificacionDeuda.GESTIONANDO;

      const { tipificacion, startDate } = await getTipificacionEnFechaCorte(
        clienteId,
        d.id,
        fechaCorte,
        tipFallback
      );

      const cat = tipificacion as TipificacionKey;
      if (!isCategoriaValida(cat)) return;

      if (isFinalTip(cat)) {
        // “terminados del año”
        if (!inicioDentroDelAnio(startDate, year)) return;
      }

      counts.set(cat, (counts.get(cat) || 0) + 1);
    })
  );

  return CATEGORIAS.map((name) => ({ name, value: counts.get(name) || 0 }));
}

/**
 * Resumen por tipificación:
 * - inmuebles: cantidad de deudores cuya tipificación (vigente a fechaCorte) coincide
 * - recaudoTotal: suma recaudos del año consultado desde enero hasta month (incluido)
 * - porRecuperar: última deuda != 0 dentro del rango enero..month del año consultado
 */
export async function obtenerResumenPorTipificacion(
  clienteId: string,
  year: number,
  month: number
): Promise<ResumenTipificacion[]> {
  const fechaCorte = buildFechaCorte(year, month);
  const yearStr = String(year);
  const cutoffMonth = month;

  const deudoresRef = collection(db, `clientes/${clienteId}/deudores`);
  const deudoresSnap = await getDocs(deudoresRef);

  const acumulado = new Map<
    TipificacionKey,
    { inmuebles: number; recaudoTotal: number; porRecuperar: number }
  >();
  CATEGORIAS.forEach((c) => acumulado.set(c, { inmuebles: 0, recaudoTotal: 0, porRecuperar: 0 }));

  // 1) Determinar tipificación vigente a fechaCorte por deudor
  const deudores = await Promise.all(
    deudoresSnap.docs.map(async (doc) => {
      const data = doc.data() as { tipificacion?: string };
      const tipFallback = (data.tipificacion as TipificacionDeuda) ?? TipificacionDeuda.GESTIONANDO;

      const { tipificacion, startDate } = await getTipificacionEnFechaCorte(
        clienteId,
        doc.id,
        fechaCorte,
        tipFallback
      );

      const cat = tipificacion as TipificacionKey;
      if (!isCategoriaValida(cat)) return null;

      if (isFinalTip(cat)) {
        if (!inicioDentroDelAnio(startDate, year)) return null;
      }

      const acc = acumulado.get(cat)!;
      acc.inmuebles += 1;

      return { id: doc.id, cat };
    })
  );

  const deudoresValidos = deudores.filter(Boolean) as { id: string; cat: TipificacionKey }[];

  // 2) Leer estados mensuales y acumular solo del año y hasta el mes consultado
  await Promise.all(
    deudoresValidos.map(async ({ id, cat }) => {
      const estadosRef = collection(db, `clientes/${clienteId}/deudores/${id}/estadosMensuales`);
      const estadosSnap = await getDocs(estadosRef);

      let recaudoTotalDeudor = 0;

      let ultimoMesConDeuda: string | null = null;
      let deudaUltimoMesNoCero = 0;

      estadosSnap.forEach((mDoc) => {
        const data = mDoc.data() as { mes?: string; deuda?: number; recaudo?: number };
        const rawMes = (data.mes || mDoc.id || "").trim(); // "YYYY-MM"
        if (!rawMes || rawMes.length < 7) return;
        if (!rawMes.startsWith(`${yearStr}-`)) return;

        const mm = Number(rawMes.split("-")[1]);
        if (!Number.isFinite(mm) || mm < 1 || mm > cutoffMonth) return;

        const recaudo = Number(data.recaudo ?? 0);
        if (Number.isFinite(recaudo)) recaudoTotalDeudor += recaudo;

        const d = Number(data.deuda ?? 0);
        const deudaValida = Number.isFinite(d) && d !== 0;

        if (deudaValida && (!ultimoMesConDeuda || rawMes > ultimoMesConDeuda)) {
          ultimoMesConDeuda = rawMes;
          deudaUltimoMesNoCero = d;
        }
      });

      const acc = acumulado.get(cat)!;
      acc.recaudoTotal += recaudoTotalDeudor;
      acc.porRecuperar += deudaUltimoMesNoCero;
    })
  );

  return CATEGORIAS.map((cat) => {
    const acc = acumulado.get(cat)!;
    return {
      tipificacion: cat,
      inmuebles: acc.inmuebles,
      recaudoTotal: acc.recaudoTotal,
      porRecuperar: acc.porRecuperar,
    };
  });
}

/**
 * Detalle por tipificación (vigente a fechaCorte) con recaudo YTD y porRecuperar YTD
 */
export async function obtenerDetalleDeudoresPorTipificacion(
  clienteId: string,
  tipificacion: TipificacionKey,
  year: number,
  month: number
): Promise<DeudorTipificacionDetalle[]> {
  const fechaCorte = buildFechaCorte(year, month);
  const yearStr = String(year);

  const deudoresRef = collection(db, `clientes/${clienteId}/deudores`);
  const deudoresSnap = await getDocs(deudoresRef);

  // 1) Filtrar por tipificación vigente a fechaCorte
  const base = await Promise.all(
    deudoresSnap.docs.map(async (doc) => {
      const data = doc.data() as { tipificacion?: string; nombre?: string; ubicacion?: string };
      const tipFallback = (data.tipificacion as TipificacionDeuda) ?? TipificacionDeuda.GESTIONANDO;

      const { tipificacion: tipEnFecha, startDate } = await getTipificacionEnFechaCorte(
        clienteId,
        doc.id,
        fechaCorte,
        tipFallback
      );

      const cat = tipEnFecha as TipificacionKey;
      if (!isCategoriaValida(cat)) return null;
      if (cat !== tipificacion) return null;

      if (isFinalTip(cat)) {
        if (!inicioDentroDelAnio(startDate, year)) return null;
      }

      return {
        deudorId: doc.id,
        tipificacion: cat,
        nombre: data.nombre ?? "",
        ubicacion: data.ubicacion ?? "",
      } as DeudorTipificacionDetalle;
    })
  );

  const deudoresFiltrados = base.filter(Boolean) as DeudorTipificacionDetalle[];
  if (!deudoresFiltrados.length) return [];

  // 2) Calcular recaudoTotal y porRecuperar dentro del año hasta month
  const detalle = await Promise.all(
    deudoresFiltrados.map(async (item) => {
      const estadosRef = collection(db, `clientes/${clienteId}/deudores/${item.deudorId}/estadosMensuales`);
      const estadosSnap = await getDocs(estadosRef);

      let recaudoTotal = 0;
      let ultimoMesConDeudaNoCero: string | null = null;
      let deudaUltimaNoCero = 0;

      estadosSnap.forEach((mDoc) => {
        const data = mDoc.data() as { mes?: string; recaudo?: number; deuda?: number };
        const rawMes = (data.mes || mDoc.id || "").trim();
        if (!rawMes || rawMes.length < 7) return;

        if (!rawMes.startsWith(`${yearStr}-`)) return;

        const mm = Number(rawMes.split("-")[1]);
        if (!Number.isFinite(mm) || mm < 1 || mm > month) return;

        const r = Number(data.recaudo ?? 0);
        if (Number.isFinite(r)) recaudoTotal += r;

        const d = Number(data.deuda ?? 0);
        const deudaValida = Number.isFinite(d) && d !== 0;

        if (deudaValida && (!ultimoMesConDeudaNoCero || rawMes > ultimoMesConDeudaNoCero)) {
          ultimoMesConDeudaNoCero = rawMes;
          deudaUltimaNoCero = d;
        }
      });

      return { ...item, recaudoTotal, porRecuperar: deudaUltimaNoCero };
    })
  );

  detalle.sort((a, b) => b.recaudoTotal - a.recaudoTotal);
  return detalle;
}
