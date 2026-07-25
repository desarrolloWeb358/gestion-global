// src/modules/cobranza/services/reportes/demandaReporteService.ts
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
import { normalizeDemandados, demandadosToString } from "../../models/deudores.model";

export type SeguimientoDemandaItem = {
  id: string;
  consecutivo: string;
  descripcion: string;
  fecha: Date | null;
  esInterno?: boolean;
};

export type DemandaDeudorItem = {
  deudorId: string;
  demandaId: string;
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

function endOfMonthExclusiveTs(year: number, month1to12: number) {
  // primer día del mes siguiente (exclusivo)
  const end = new Date(year, month1to12, 1, 0, 0, 0, 0);
  return Timestamp.fromDate(end);
}

// Lee los seguimientos de una subcolección seguimientoDemanda, filtra por rango + visibilidad cliente.
async function leerSeguimientosVisibles(
  path: string,
  endTs: Timestamp
): Promise<SeguimientoDemandaItem[]> {
  const segRef = collection(db, path);
  const qSeg = query(segRef, where("fecha", "<", endTs), orderBy("fecha", "asc"));
  const segSnap = await getDocs(qSeg);

  return segSnap.docs
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
      } as SeguimientoDemandaItem;
    })
    .filter(Boolean) as SeguimientoDemandaItem[];
}

/**
 * Seguimiento de demandas del cliente (corte mensual).
 * Devuelve UNA fila por demanda (no por deudor): todas las demandas de todos los
 * deudores del cliente cuya tipificación vigente sea Demanda*, cada una con su
 * seguimiento del corte. Si un deudor aún no tiene subcolección `demandas`
 * (no migrado), cae al modelo legacy (campos del deudor + su seguimientoDemanda).
 */
export async function obtenerDemandasConSeguimientoCliente(
  clienteId: string,
  year: number,
  month: number
): Promise<DemandaDeudorItem[]> {
  const fechaCorte = buildFechaCorte(year, month);
  const endTs = endOfMonthExclusiveTs(year, month);

  const deudoresRef = collection(db, `clientes/${clienteId}/deudores`);
  const deudoresSnap = await getDocs(deudoresRef);

  // 1) Filtrar deudores por tipificación vigente a fechaCorte
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
      if (!TIP_DEMANDA.has(tipificacion)) return null;
      if (isFinalTip(tipificacion)) {
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

  // 2) Para cada deudor: una fila por demanda (o legacy si no hay subcolección)
  const itemsPorDeudor = await Promise.all(
    deudoresDemanda.map(async ({ id, data, tipificacion }) => {
      const ubicacionDeudor = String(data.ubicacion ?? "");
      const tip = String(tipificacion);

      const demandasSnap = await getDocs(
        collection(db, `clientes/${clienteId}/deudores/${id}/demandas`)
      );

      // Modelo nuevo: una fila por demanda
      if (!demandasSnap.empty) {
        return Promise.all(
          demandasSnap.docs.map(async (dem) => {
            const ddata = dem.data() as any;
            const seguimientos = await leerSeguimientosVisibles(
              `clientes/${clienteId}/deudores/${id}/demandas/${dem.id}/seguimientoDemanda`,
              endTs
            );
            return {
              deudorId: id,
              demandaId: dem.id,
              ubicacion: String(ddata.ubicacion ?? ubicacionDeudor),
              demandados: demandadosToString(normalizeDemandados(ddata.demandados)),
              numeroRadicado: String(ddata.numeroRadicado ?? ""),
              juzgado: String(ddata.juzgado ?? ""),
              tipificacion: tip,
              observacionCliente: String(ddata.observacionesDemandaCliente ?? ""),
              seguimientos,
            } as DemandaDeudorItem;
          })
        );
      }

      // Legacy: campos en el deudor + seguimientoDemanda del deudor
      const seguimientos = await leerSeguimientosVisibles(
        `clientes/${clienteId}/deudores/${id}/seguimientoDemanda`,
        endTs
      );
      return [
        {
          deudorId: id,
          demandaId: `legacy-${id}`,
          ubicacion: ubicacionDeudor,
          demandados: demandadosToString(normalizeDemandados(data.demandados)),
          numeroRadicado: String(data.numeroRadicado ?? ""),
          juzgado: String(data.juzgado ?? ""),
          tipificacion: tip,
          observacionCliente: String(data.observacionesDemandaCliente ?? ""),
          seguimientos,
        } as DemandaDeudorItem,
      ];
    })
  );

  const items = itemsPorDeudor
    .flat()
    .filter((it) => it.seguimientos.length > 0);

  items.sort((a, b) => (a.ubicacion || "").localeCompare(b.ubicacion || "", "es"));
  return items;
}
