// src/modules/cobranza/services/reportes/reporteDeudoresService.ts
import { db } from "@/firebase";
import { collection, getDocs, Timestamp, query, where, orderBy, limit } from "firebase/firestore";
import type { FilaReporte } from "./tipos";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";

function toDateSafe(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "object" && typeof v.seconds === "number") return new Date(v.seconds * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function buildFechaCorte(year: number, month: number): Date {
  // último día del mes 23:59:59.999
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

export async function obtenerReporteDeudoresPorPeriodo(
  clienteId: string,
  year: number,
  month: number // 1..12
): Promise<FilaReporte[]> {
  const yearStr = String(year);
  const fechaCorte = buildFechaCorte(year, month);

  const deudoresRef = collection(db, `clientes/${clienteId}/deudores`);
  const deudoresSnap = await getDocs(deudoresRef);

  const filasPromises = deudoresSnap.docs.map(async (deudorDoc) => {
    const d = deudorDoc.data() as any;

    const tipFallback = (d?.tipificacion as TipificacionDeuda) ?? TipificacionDeuda.GESTIONANDO;

    // ✅ calcular tipificación vigente a fechaCorte
    const { tipificacion: tipEnFecha, startDate } = await getTipificacionEnFechaCorte(
      clienteId,
      deudorDoc.id,
      fechaCorte,
      tipFallback
    );

    // ✅ excluir INACTIVO
    if (tipEnFecha === TipificacionDeuda.INACTIVO) return null;

    // ✅ TERMINADO / DEMANDA_TERMINADO solo si entró a ese estado en el año consultado
    if (isFinalTip(tipEnFecha)) {
      if (!inicioDentroDelAnio(startDate, year)) return null;
    }

    const nombre = d?.nombre ?? "";
    const inmueble = d?.ubicacion ?? d?.inmueble ?? "";

    const estadosRef = collection(db, `clientes/${clienteId}/deudores/${deudorDoc.id}/estadosMensuales`);
    const estadosSnap = await getDocs(estadosRef);

    const rec: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) rec[String(m).padStart(2, "0")] = 0;

    let porRecaudar = 0;
    let ultimoMesConDeuda: string | null = null;

    estadosSnap.forEach((mDoc) => {
      const data = mDoc.data() as { mes?: string; deuda?: number; recaudo?: number };
      const mesId = (data.mes || mDoc.id || "").trim(); // "YYYY-MM"
      if (!mesId || mesId.length < 7) return;
      if (!mesId.startsWith(`${yearStr}-`)) return;

      const mmStr = mesId.split("-")[1];
      const mm = Number(mmStr);
      if (!Number.isFinite(mm) || mm < 1 || mm > month) return; // ✅ solo hasta el mes consultado

      const deudaNum = Number(data.deuda ?? 0);
      const recVal = Number(data.recaudo ?? 0);

      if (Number.isFinite(recVal)) rec[mmStr] = (rec[mmStr] ?? 0) + recVal;

      const deudaValida = Number.isFinite(deudaNum) && deudaNum !== 0;
      if (deudaValida && (!ultimoMesConDeuda || mesId > ultimoMesConDeuda)) {
        ultimoMesConDeuda = mesId;
        porRecaudar = deudaNum;
      }
    });

    // ✅ total solo hasta el mes consultado
    let recaudoTotal = 0;
    for (let m = 1; m <= month; m++) {
      const k = String(m).padStart(2, "0");
      recaudoTotal += Number(rec[k] ?? 0);
    }

    const fila: FilaReporte = {
      tipificacion: String(tipEnFecha), // tu tipo actual usa string
      inmueble,
      nombre,
      porRecaudar,
      rec_01: rec["01"], rec_02: rec["02"], rec_03: rec["03"], rec_04: rec["04"],
      rec_05: rec["05"], rec_06: rec["06"], rec_07: rec["07"], rec_08: rec["08"],
      rec_09: rec["09"], rec_10: rec["10"], rec_11: rec["11"], rec_12: rec["12"],
      recaudoTotal,
    };

    return fila;
  });

  const filasAll = await Promise.all(filasPromises);
  const filas = filasAll.filter(Boolean) as FilaReporte[];

  filas.sort(
    (a, b) =>
      (a.tipificacion || "").localeCompare(b.tipificacion || "") ||
      (a.inmueble || "").localeCompare(b.inmueble || "")
  );

  return filas;
}
