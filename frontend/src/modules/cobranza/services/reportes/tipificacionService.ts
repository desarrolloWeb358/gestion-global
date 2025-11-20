// src/modules/cobranza/services/reportes/tipificacionService.ts

import { db } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";
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
  TipificacionDeuda.DEMANDAACUERDO,
  // TipificacionDeuda.INACTIVO,
];

// --- helper interno para normalizar la tipificación de un deudor ---
function normalizarTipificacion(rawTip?: string): TipificacionKey {
  const raw = String(rawTip ?? "").trim();

  // 1) Si coincide exacto con el enum
  if (Object.values(TipificacionDeuda).includes(raw as TipificacionDeuda)) {
    return raw as TipificacionKey;
  }

  // 2) Fallback por textos antiguos / variantes
  const upper = raw.toUpperCase();

  if (upper.includes("DEMANDA") && upper.includes("ACUERDO")) {
    return TipificacionDeuda.DEMANDAACUERDO;
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

  snap.forEach((doc) => {
    const data = doc.data() as { tipificacion?: string };
    const cat = normalizarTipificacion(data.tipificacion);
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

  // primero definimos deudores con su categoría normalizada
  const deudores = deudoresSnap.docs.map((doc) => {
    const data = doc.data() as { tipificacion?: string };
    const cat = normalizarTipificacion(data.tipificacion);
    // ya contamos el inmueble
    const acc = acumulado.get(cat)!;
    acc.inmuebles += 1;
    return { id: doc.id, cat };
  });

  // luego leemos estadosMensuales de cada deudor en paralelo
  const estadosPromises = deudores.map(async ({ id, cat }) => {
    const estadosRef = collection(
      db,
      `clientes/${clienteId}/deudores/${id}/estadosMensuales`
    );
    const estadosSnap = await getDocs(estadosRef);

    let recaudoTotalDeudor = 0;
    let ultimoMesClave: string | null = null;
    let deudaUltimoMes = 0;

    estadosSnap.forEach((mDoc) => {
      const data = mDoc.data() as {
        mes?: string;
        deuda?: number;
        recaudo?: number;
      };

      const rawMes = (data.mes || mDoc.id || "").trim(); // "YYYY-MM"
      if (rawMes) {
        // recaudo total de todos los meses
        const recaudo = Number(data.recaudo ?? 0);
        if (Number.isFinite(recaudo)) {
          recaudoTotalDeudor += recaudo;
        }

        // buscamos el último mes reportado (mayor "YYYY-MM")
        if (!ultimoMesClave || rawMes > ultimoMesClave) {
          ultimoMesClave = rawMes;
          const d = Number(data.deuda ?? 0);
          deudaUltimoMes = Number.isFinite(d) ? d : 0;
        }
      }
    });

    const acc = acumulado.get(cat)!;
    acc.recaudoTotal += recaudoTotalDeudor;
    acc.porRecuperar += deudaUltimoMes;
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

  // 1) Filtramos deudores por tipificación (normalizada)
  const deudoresFiltrados = deudoresSnap.docs
    .map((doc) => {
      const data = doc.data() as {
        tipificacion?: string;
        nombre?: string;
        ubicacion?: string;
      };

      const cat = normalizarTipificacion(data.tipificacion);

      if (cat !== tipificacion) return null;

      return {
        deudorId: doc.id,
        tipificacion: cat,
        // 👇 Ajusta estos campos si en tu colección se llaman distinto
        nombre: data.nombre ?? "",
        ubicacion: data.ubicacion ?? "",
      };
    })
    .filter(Boolean) as DeudorTipificacionDetalle[];

  if (!deudoresFiltrados.length) return [];

  // 2) Para cada deudor, leer estadosMensuales y sumar recaudo
  const detalleConRecaudo = await Promise.all(
    deudoresFiltrados.map(async (item) => {
      const estadosRef = collection(
        db,
        `clientes/${clienteId}/deudores/${item.deudorId}/estadosMensuales`
      );
      const estadosSnap = await getDocs(estadosRef);

      let recaudoTotal = 0;
      let ultimoMesClave: string | null = null;
      let deudaUltimoMes = 0;

      estadosSnap.forEach((mDoc) => {
        const data = mDoc.data() as { mes?: string; recaudo?: number; deuda?: number };

        const rawMes = (data.mes || mDoc.id || "").trim(); // "YYYY-MM"

        // 1) Acumular recaudo total
        const valor = Number(data.recaudo ?? 0);
        if (Number.isFinite(valor)) {
          recaudoTotal += valor;
        }

        // 2) Detectar el último mes y tomar su deuda
        if (rawMes) {
          if (!ultimoMesClave || rawMes > ultimoMesClave) {
            ultimoMesClave = rawMes;
            const d = Number(data.deuda ?? 0);
            deudaUltimoMes = Number.isFinite(d) ? d : 0;
          }
        }
      });

      return {
        ...item,
        recaudoTotal,
        porRecuperar: deudaUltimoMes, // 👈 NUEVO
      };
    })
  );

  // Ordenamos por recaudo mayor a menor (como en tu Excel)
  detalleConRecaudo.sort((a, b) => b.recaudoTotal - a.recaudoTotal);

  return detalleConRecaudo;
}

