// src/modules/cobranza/services/reportes/seguimientoDemandaService.ts
import { db } from "@/firebase";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";

// ✅ Reutilizamos tus helpers del tipificacionService
import {
  buildFechaCorte,
  getTipificacionEnFechaCorte,
  inicioDentroDelAnio,
  isFinalTip,
} from "./tipificacionService"; // ajusta ruta si es diferente

export type SeguimientoDemandaItem = {
  id: string;
  consecutivo: string;
  descripcion: string;
  fecha: Date | null;
  esInterno?: boolean;
};

export type DemandaDeudorItem = {
  deudorId: string;
  ubicacion: string;
  demandados: string;
  numeroRadicado: string;
  juzgado: string;
  tipificacion: string;
  observacionCliente: string;
  seguimientos: SeguimientoDemandaItem[];
};

const TIP_DEMANDA = new Set<TipificacionDeuda>([
  TipificacionDeuda.DEMANDA,
  TipificacionDeuda.DEMANDA_ACUERDO,
  TipificacionDeuda.DEMANDA_TERMINADO,
]);

function toDateSafe(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthRange(year: number, month1to12: number) {
  const start = new Date(year, month1to12 - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month1to12, 1, 0, 0, 0, 0);
  return {
    startTs: Timestamp.fromDate(start),
    endTs: Timestamp.fromDate(end),
  };
}

function endOfMonthExclusiveTs(year: number, month1to12: number) {
  // primer día del mes siguiente (exclusivo)
  const end = new Date(year, month1to12, 1, 0, 0, 0, 0);
  return Timestamp.fromDate(end);
}

/**
 * Seguimiento de demandas (corte mensual):
 * 1) Para cada deudor determina tipificación "vigente" a fechaCorte (year+month) usando historialTipificaciones.
 * 2) Solo incluye deudores cuya tipificación vigente sea DEMANDA / DEMANDA_ACUERDO / DEMANDA_TERMINADO.
 *    - Si es un estado final (DEMANDA_TERMINADO), solo si su inicio (startDate) cae dentro del año consultado.
 * 3) Para esos deudores, trae seguimientoDemanda filtrado por rango del mes.
 * 4) Muestra el deudor si tiene seguimientos en ese mes OR si tiene observacionesDemandaCliente (sin filtro fecha).
 */
export async function obtenerDemandasConSeguimientoCliente(
  clienteId: string,
  year: number,
  month: number
): Promise<DemandaDeudorItem[]> {
  const fechaCorte = buildFechaCorte(year, month);

  const endTs = endOfMonthExclusiveTs(year, month);

  // 0) Traer TODOS los deudores (porque el filtro real es por historialTipificaciones)
  const deudoresRef = collection(db, `clientes/${clienteId}/deudores`);
  const deudoresSnap = await getDocs(deudoresRef);

  // 1) Filtrar por tipificación vigente a fechaCorte (historialTipificaciones)
  const candidatos = await Promise.all(
    deudoresSnap.docs.map(async (doc) => {
      const data = doc.data() as any;

      const tipFallback = (data.tipificacion as TipificacionDeuda) ?? TipificacionDeuda.GESTIONANDO;

      const { tipificacion, startDate } = await getTipificacionEnFechaCorte(
        clienteId,
        doc.id,
        fechaCorte,
        tipFallback
      );

      // Solo demanda*
      if (!TIP_DEMANDA.has(tipificacion)) return null;

      // Si es final (para ti, DEMANDA_TERMINADO entra aquí por isFinalTip)
      if (isFinalTip(tipificacion)) {
        // misma regla que tu reporte: “terminados del año”
        if (!inicioDentroDelAnio(startDate, year)) return null;
      }

      return { id: doc.id, data, tipificacion };
    })
  );

  const deudoresDemanda = candidatos.filter(Boolean) as Array<{
    id: string;
    data: any;
    tipificacion: TipificacionDeuda;
  }>;

  // 2) Para cada deudor (ya filtrado), traer seguimientoDemanda del mes
  const itemsAll = await Promise.all(
    deudoresDemanda.map(async ({ id, data, tipificacion }) => {
      const ubicacion = String(data.ubicacion ?? "");
      const demandados = String(data.demandados ?? "");
      const numeroRadicado = String(data.numeroRadicado ?? "");
      const juzgado = String(data.juzgado ?? "");
      const observacionCliente = String(data.observacionesDemandaCliente ?? "");

      const segRef = collection(db, `clientes/${clienteId}/deudores/${id}/seguimientoDemanda`);

      // Nota: para range necesitas orderBy("fecha")
      const qSeg = query(
        segRef,
        where("fecha", "<", endTs),     // ✅ todo lo anterior al 1ro del mes siguiente
        orderBy("fecha", "asc")
      );

      const segSnap = await getDocs(qSeg);

      const seguimientosMes: SeguimientoDemandaItem[] = segSnap.docs
        .map((s) => {
          const sdata = s.data() as any;
          const esInterno = sdata.esInterno as boolean | undefined;
          const visibleCliente = esInterno === false || esInterno == null;
          if (!visibleCliente) return null;

          return {
            id: s.id,
            consecutivo: String(sdata.consecutivo ?? ""),
            descripcion: String(sdata.descripcion ?? ""),
            fecha: toDateSafe(sdata.fecha),
            esInterno,
          };
        })
        .filter(Boolean) as SeguimientoDemandaItem[];

      return {
        deudorId: id,
        ubicacion,
        demandados,
        numeroRadicado,
        juzgado,
        tipificacion: String(tipificacion),
        observacionCliente,
        seguimientos: seguimientosMes,
      } as DemandaDeudorItem;
    })
  );

  const items = itemsAll.filter((it) => {
    const tieneSeguimiento = it.seguimientos.length > 0; // ahora es "hasta corte"
    const tieneObservacion = (it.observacionCliente ?? "").trim().length > 0;
    return tieneSeguimiento || tieneObservacion;
  });

  items.sort((a, b) => (a.ubicacion || "").localeCompare(b.ubicacion || "", "es"));
  return items;
}
