// src/modules/cobranza/services/reportes/tipificacionService.ts

import { db } from "@/firebase";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { TipificacionDeuda } from "../../../../shared/constants/tipificacionDeuda";

export type TipificacionKey = TipificacionDeuda;

export interface PieItem {
  name: TipificacionKey;
  value: number;
}

// NUEVO: interfaz para la tabla de resumen
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

// Solo las categorías que quieres graficar
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
  // TipificacionDeuda.INACTIVO,
];

const ES_CATEGORIA = new Set<TipificacionKey>(CATEGORIAS);

function isCategoriaValida(cat: any): cat is TipificacionKey {
  return ES_CATEGORIA.has(cat);
}

// --- helper interno para normalizar la tipificación de un deudor ---
/*
function normalizarTipificacion(rawTip?: string): TipificacionKey {
  const raw = String(rawTip ?? "").trim();

  // 1) Si coincide exacto con el enum
  if (Object.values(TipificacionDeuda).includes(raw as TipificacionDeuda)) {
    return raw as TipificacionKey;
  }

  // 2) Fallback por textos antiguos / variantes
  const upper = raw.toUpperCase();

  if (upper.includes("DEMANDA") && upper.includes("ACUERDO")) {
    return TipificacionDeuda.DEMANDA_ACUERDO;
  } else if (upper.includes("GESTION")) {
    return TipificacionDeuda.GESTIONANDO;
  } else if (upper.includes("DEVUEL")) {
    return TipificacionDeuda.DEVUELTO;
  } else if (upper.includes("ACUERD")) {
    return TipificacionDeuda.ACUERDO;
  } else if (upper.includes("TERMIN")) {
    return TipificacionDeuda.TERMINADO;
  } else if (upper.includes("DEMANDA")) {
    return TipificacionDeuda.DEMANDA;
  }

  // default
  return TipificacionDeuda.GESTIONANDO;
}
  */

function toDateSafe(v: any): Date | null {
  if (!v) return null;

  // Date directo
  if (v instanceof Date) return v;

  // Firestore Timestamp
  if (v instanceof Timestamp) return v.toDate();

  // Objeto tipo {seconds, nanoseconds} (tu modelo lo permite)
  if (typeof v === "object" && typeof v.seconds === "number") {
    return new Date(v.seconds * 1000);
  }

  // (opcional) si algún día te llega string
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function isTerminadoDentroDelAnio(fechaTerminado: any, year: number): boolean {
  const f = toDateSafe(fechaTerminado);
  if (!f) return false; // si está "Terminado" pero no hay fecha, se excluye (seguro)
  const inicio = new Date(year, 0, 1);
  const fin = new Date(year + 1, 0, 1);
  return f >= inicio && f < fin;
}

/**
 * Lee clientes/{clienteId}/deudores y cuenta por 'tipificacion'
 */
export async function contarTipificacionPorCliente(
  clienteId: string
): Promise<PieItem[]> {
  const ref = collection(db, `clientes/${clienteId}/deudores`);
  const snap = await getDocs(ref);

  const counts = new Map<TipificacionKey, number>();
  CATEGORIAS.forEach((c) => counts.set(c, 0));

  const yearActual = new Date().getFullYear(); // luego lo parametrizamos si quieres

  snap.forEach((doc) => {
    const data = doc.data() as {
      tipificacion?: string;
      fechaTerminado?: any;
    };

    const cat = data.tipificacion as TipificacionKey;

    // Ignorar INACTIVO y cualquier cosa fuera de CATEGORIAS
    if (!isCategoriaValida(cat)) return;

    const yearActual = new Date().getFullYear();

    // ✅ NUEVO: TERMINADO solo si fechaTerminado está dentro del año actual
    if (cat === TipificacionDeuda.TERMINADO) {
      console.log("Verificando TERMINADO para doc:", doc.id);
      console.log("  fechaTerminado:", data.fechaTerminado);
      console.log("  yearActual:", yearActual);
      if (!isTerminadoDentroDelAnio(data.fechaTerminado, yearActual)) return;
    }

    counts.set(cat, (counts.get(cat) || 0) + 1);
  });

  return CATEGORIAS.map((name) => ({
    name,
    value: counts.get(name) || 0,
  }));
}


/**
 * NUEVO:
 * Para cada tipificación calcula:
 * - inmuebles: cantidad de deudores
 * - recaudoTotal: suma de todos los recaudos de todos los meses de esos deudores
 * - porRecuperar: suma de la deuda del último mes reportado de cada deudor
 *
 * Estructura usada:
 * clientes/{clienteId}/deudores/{deudorId}/estadosMensuales/{YYYY-MM}
 *   { deuda: number; honorarios: number; acuerdo: number; recaudo: number; mes?: string; }
 */
export async function obtenerResumenPorTipificacion(
  clienteId: string
): Promise<ResumenTipificacion[]> {
  const deudoresRef = collection(db, `clientes/${clienteId}/deudores`);
  const deudoresSnap = await getDocs(deudoresRef);

  // mapa categoria -> acumuladores
  const acumulado = new Map<
    TipificacionKey,
    { inmuebles: number; recaudoTotal: number; porRecuperar: number }
  >();
  CATEGORIAS.forEach((c) =>
    acumulado.set(c, { inmuebles: 0, recaudoTotal: 0, porRecuperar: 0 })
  );

  const yearActual = new Date().getFullYear(); // o pásalo por parámetro (te lo recomiendo)
  const deudores = deudoresSnap.docs
    .map((doc) => {
      const data = doc.data() as { tipificacion?: string; fechaTerminado?: any };
      const cat = data.tipificacion as TipificacionKey;

      if (!isCategoriaValida(cat)) return null;

      // FILTRO: Terminado solo si fechaTerminado está dentro del año actual
      if (cat === TipificacionDeuda.TERMINADO) {
        const ok = isTerminadoDentroDelAnio(data.fechaTerminado, yearActual);
        if (!ok) return null;
      }

      const acc = acumulado.get(cat)!;
      acc.inmuebles += 1;

      return { id: doc.id, cat };
    })
    .filter(Boolean) as { id: string; cat: TipificacionKey }[];


  // luego leemos estadosMensuales de cada deudor en paralelo
  const estadosPromises = deudores.map(async ({ id, cat }) => {
    const estadosRef = collection(
      db,
      `clientes/${clienteId}/deudores/${id}/estadosMensuales`
    );
    const estadosSnap = await getDocs(estadosRef);

    let recaudoTotalDeudor = 0;

    // ✅ REGla 1: último mes con deuda != 0
    let ultimoMesConDeuda: string | null = null;
    let deudaUltimoMesNoCero = 0;

    estadosSnap.forEach((mDoc) => {
      const data = mDoc.data() as {
        mes?: string;
        deuda?: number;
        recaudo?: number;
      };

      const rawMes = (data.mes || mDoc.id || "").trim(); // "YYYY-MM"
      if (!rawMes) return;

      // suma recaudo de todos los meses
      const recaudo = Number(data.recaudo ?? 0);
      if (Number.isFinite(recaudo)) {
        recaudoTotalDeudor += recaudo;
      }

      // ✅ solo considerar deuda != 0
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
  });

  await Promise.all(estadosPromises);

  // devolvemos en el mismo orden de CATEGORIAS
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
 * Devuelve, para una tipificación dada, el listado de deudores con:
 * - inmueble (ubicación)
 * - nombre del deudor
 * - recaudoTotal (suma de todos los recaudos de todos los meses)
 */
export async function obtenerDetalleDeudoresPorTipificacion(
  clienteId: string,
  tipificacion: TipificacionKey
): Promise<DeudorTipificacionDetalle[]> {
  const deudoresRef = collection(db, `clientes/${clienteId}/deudores`);
  const deudoresSnap = await getDocs(deudoresRef);

  const yearActual = new Date().getFullYear();
  const yearStr = String(yearActual);

  // 1) Filtramos deudores por tipificación + filtro especial TERMINADO por fechaTerminado (año en curso)
  const deudoresFiltrados = deudoresSnap.docs
    .map((doc) => {
      const data = doc.data() as {
        tipificacion?: string;
        nombre?: string;
        ubicacion?: string;
        fechaTerminado?: any;
      };

      const cat = data.tipificacion as TipificacionKey;
      if (!isCategoriaValida(cat)) return null;
      if (cat !== tipificacion) return null;

      // ✅ TERMINADO solo si fechaTerminado está dentro del año en curso
      if (cat === TipificacionDeuda.TERMINADO) {
        if (!isTerminadoDentroDelAnio(data.fechaTerminado, yearActual)) return null;
      }

      return {
        deudorId: doc.id,
        tipificacion: cat,
        nombre: data.nombre ?? "",
        ubicacion: data.ubicacion ?? "",
      };
    })
    .filter(Boolean) as DeudorTipificacionDetalle[];

  if (!deudoresFiltrados.length) return [];

  // 2) Para cada deudor, leer estadosMensuales y calcular:
  //    - recaudoTotal del año en curso
  //    - porRecuperar = última deuda != 0 del año en curso (si no hay -> 0)
  const detalleConRecaudo = await Promise.all(
    deudoresFiltrados.map(async (item) => {
      const estadosRef = collection(
        db,
        `clientes/${clienteId}/deudores/${item.deudorId}/estadosMensuales`
      );
      const estadosSnap = await getDocs(estadosRef);

      let recaudoTotal = 0;

      // ✅ Regla 1: última deuda != 0 del año en curso
      let ultimoMesConDeudaNoCero: string | null = null;
      let deudaUltimaNoCero = 0;

      estadosSnap.forEach((mDoc) => {
        const data = mDoc.data() as { mes?: string; recaudo?: number; deuda?: number };
        const rawMes = (data.mes || mDoc.id || "").trim(); // "YYYY-MM"
        if (!rawMes || rawMes.length < 7) return;

        // ✅ Solo meses del año en curso
        if (!rawMes.startsWith(`${yearStr}-`)) return;

        // 1) Sumar recaudo del año
        const r = Number(data.recaudo ?? 0);
        if (Number.isFinite(r)) recaudoTotal += r;

        // 2) Última deuda != 0 del año
        const d = Number(data.deuda ?? 0);
        const deudaValida = Number.isFinite(d) && d !== 0;

        if (deudaValida && (!ultimoMesConDeudaNoCero || rawMes > ultimoMesConDeudaNoCero)) {
          ultimoMesConDeudaNoCero = rawMes;
          deudaUltimaNoCero = d;
        }
      });

      return {
        ...item,
        recaudoTotal,
        porRecuperar: deudaUltimaNoCero, // ✅ si no hubo deuda != 0, queda 0
      };
    })
  );

  // (Opcional) orden
  detalleConRecaudo.sort((a, b) => b.recaudoTotal - a.recaudoTotal);

  return detalleConRecaudo;
}


