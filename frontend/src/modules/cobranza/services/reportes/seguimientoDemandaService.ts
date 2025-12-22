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

export type SeguimientoDemandaItem = {
  id: string;
  consecutivo: string;
  descripcion: string;
  fecha: Date | null;
  esInterno?: boolean;
};

export type DemandaDeudorItem = {
  deudorId: string;

  // “cabecera” de la demanda (del documento deudor)
  ubicacion: string; // inmueble
  demandados: string;
  numeroRadicado: string;
  juzgado: string;
  tipificacion: string;

  // primera observación del cliente (del documento deudor)
  observacionCliente: string;

  // seguimiento visible para cliente (subcolección)
  seguimientos: SeguimientoDemandaItem[];
};

const TIP_DEMANDA = [
  TipificacionDeuda.DEMANDA,
  TipificacionDeuda.DEMANDA_ACUERDO,
  TipificacionDeuda.DEMANDA_TERMINADO,
] as const;

function toDateSafe(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  // por si viene como string
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Lee:
 * clientes/{clienteId}/deudores WHERE tipificacion IN (DEMANDA*)
 * y por cada deudor lee:
 * clientes/{clienteId}/deudores/{deudorId}/seguimientoDemanda ORDER BY fecha asc
 * filtrando: esInterno === false OR esInterno missing
 */
export async function obtenerDemandasConSeguimientoCliente(
  clienteId: string
): Promise<DemandaDeudorItem[]> {
  // 1) Traer deudores en DEMANDA*
  const deudoresRef = collection(db, `clientes/${clienteId}/deudores`);
  const qDeudores = query(
    deudoresRef,
    where("tipificacion", "in", [...TIP_DEMANDA])
  );

  const deudoresSnap = await getDocs(qDeudores);

  // 2) Para cada deudor traer seguimientoDemanda
  const items = await Promise.all(
    deudoresSnap.docs.map(async (d) => {
      const data = d.data() as any;

      const ubicacion = String(data.ubicacion ?? "");
      const demandados = String(data.demandados ?? "");
      const numeroRadicado = String(data.numeroRadicado ?? "");
      const juzgado = String(data.juzgado ?? "");
      const tipificacion = String(data.tipificacion ?? "");
      const observacionCliente = String(data.observacionesDemandaCliente ?? "");

      const segRef = collection(
        db,
        `clientes/${clienteId}/deudores/${d.id}/seguimientoDemanda`
      );
      const qSeg = query(segRef, orderBy("fecha", "asc"));
      const segSnap = await getDocs(qSeg);

      const seguimientos: SeguimientoDemandaItem[] = segSnap.docs
        .map((s) => {
          const sdata = s.data() as any;

          // ✅ regla: mostrar si esInterno == false o no existe
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
        deudorId: d.id,
        ubicacion,
        demandados,
        numeroRadicado,
        juzgado,
        tipificacion,
        observacionCliente,
        seguimientos,
      } as DemandaDeudorItem;
    })
  );

  // Orden recomendado: por ubicacion (o por radicado)
  items.sort((a, b) => (a.ubicacion || "").localeCompare(b.ubicacion || "", "es"));

  return items;
}
