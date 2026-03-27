// src/modules/cobranza/services/reportes/recaudosService.ts
import { db } from "@/firebase";
import { collection, collectionGroup,
  getDocs,
  limit,
  query,
  where, } from "firebase/firestore";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";
import {
  buildFechaCorte,
  getTipificacionEnFechaCorte,
  isFinalTip,
  inicioDentroDelAnio,
  CATEGORIAS,
} from "./tipificacionService";

export interface MesTotal {
  mes: string;   // "YYYY-MM"
  total: number; // suma del campo 'recaudo' del mes para todos los deudores
}

const ES_CATEGORIA = new Set(CATEGORIAS);

/**
 * Suma 'recaudo' por mes (id o campo 'mes' = "YYYY-MM") para los deudores del cliente,
 * aplicando el mismo filtro de tipificación que la tabla de resumen:
 * - Excluye deudores en estado final (TERMINADO, DEMANDA_TERMINADO, DEVUELTO)
 *   cuya fecha de inicio de ese estado sea de un año anterior al consultado.
 * - Rellena meses sin datos con total = 0.
 */
export async function obtenerRecaudosMensuales(
  clienteId: string,
  year: number,
  month: number
): Promise<MesTotal[]> {
  const yearStr = String(year);
  const currentMonth = month; // 1..12
  const fechaCorte = buildFechaCorte(year, month);

  const acumulado = new Map<string, number>();
  for (let m = 1; m <= currentMonth; m++) {
    const mm = String(m).padStart(2, "0");
    acumulado.set(`${yearStr}-${mm}`, 0);
  }

  const deudoresRef = collection(db, `clientes/${clienteId}/deudores`);
  const deudoresSnap = await getDocs(deudoresRef);

  // Filtrar deudores con el mismo criterio que obtenerResumenPorTipificacion
  const deudoresFiltrados = (
    await Promise.all(
      deudoresSnap.docs.map(async (deudorDoc) => {
        const data = deudorDoc.data() as { tipificacion?: string };
        const tipFallback = (data.tipificacion as TipificacionDeuda) ?? TipificacionDeuda.GESTIONANDO;

        const { tipificacion, startDate } = await getTipificacionEnFechaCorte(
          clienteId,
          deudorDoc.id,
          fechaCorte,
          tipFallback
        );

        if (!ES_CATEGORIA.has(tipificacion)) return null;

        if (isFinalTip(tipificacion)) {
          if (!inicioDentroDelAnio(startDate, year)) return null;
        }

        return deudorDoc.id;
      })
    )
  ).filter(Boolean) as string[];

  const estadosSnaps = await Promise.all(
    deudoresFiltrados.map((deudorId) => {
      const estadosRef = collection(db, `clientes/${clienteId}/deudores/${deudorId}/estadosMensuales`);
      return getDocs(estadosRef);
    })
  );

  for (const estadosSnap of estadosSnaps) {
    estadosSnap.forEach((mDoc) => {
      const data = mDoc.data() as { mes?: string; recaudo?: number };
      const rawMes = (data.mes || mDoc.id || "").trim();
      if (!rawMes || rawMes.length < 7) return;
      if (!rawMes.startsWith(`${yearStr}-`)) return;

      const mm = Number(rawMes.split("-")[1]);
      if (!Number.isFinite(mm) || mm < 1 || mm > currentMonth) return;

      const claveMes = `${yearStr}-${String(mm).padStart(2, "0")}`;
      const valor = Number(data.recaudo ?? 0);
      if (!Number.isFinite(valor)) return;

      acumulado.set(claveMes, (acumulado.get(claveMes) || 0) + valor);
    });
  }

  return [...acumulado.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([mes, total]) => ({ mes, total }));
}

function buildMesKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export async function existeEstadoMensualClienteEnPeriodo(
  clienteId: string,
  year: number,
  month: number
): Promise<boolean> {
  const mes = buildMesKey(year, month);

  const q = query(
    collectionGroup(db, "estadosMensuales"),
    where("clienteUID", "==", clienteId),
    where("mes", "==", mes),
    limit(1)
  );

  const snap = await getDocs(q);
  return !snap.empty;
}