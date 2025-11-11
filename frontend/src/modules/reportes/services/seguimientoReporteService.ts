import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
  Timestamp,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/firebase";
import {
  ResumenEjecutivo,
  SeguimientoReporteItem,
  TipoSeguimientoOrigen,
} from "../models/seguimientoReporte.model";



// Normalizar fechas a inicio/fin de día
function normalizeStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function normalizeEnd(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

const SUBS: { name: string; origen: TipoSeguimientoOrigen }[] = [
  { name: "seguimiento", origen: "prejuridico" },
  { name: "seguimientoJuridico", origen: "juridico" },
  { name: "seguimientoDemanda", origen: "demanda" },
];

/**
 * Lee todos los seguimientos del rango usando collectionGroup para las 3 subcolecciones.
 * Opcionalmente filtra por clienteUID.
 */
export async function obtenerSeguimientosRango(
  desde: Date,
  hasta: Date,
  clienteUID?: string
): Promise<SeguimientoReporteItem[]> {
  const fromTs = Timestamp.fromDate(normalizeStart(desde));
  const toTs = Timestamp.fromDate(normalizeEnd(hasta));

  const result: SeguimientoReporteItem[] = [];

  for (const { name, origen } of SUBS) {
    const constraints: QueryConstraint[] = [
      where("fechaCreacion", ">=", fromTs),
      where("fechaCreacion", "<=", toTs),
    ];
    if (clienteUID) {
      // mismo campo en las 3 colecciones
      constraints.push(where("clienteUID", "==", clienteUID));
    }

    const cg = collectionGroup(db, name);
    const qy = query(cg, ...constraints);
    const snap = await getDocs(qy);

    snap.forEach((docSnap) => {
      const d: any = docSnap.data() || {};
      const ts: any = d.fechaCreacion;
      let fechaCreacion: Date | undefined;
      if (ts?.toDate) fechaCreacion = ts.toDate();

      result.push({
        id: docSnap.id,
        clienteUID: d.clienteUID,
        ejecutivoUID: d.ejecutivoUID,
        fechaCreacion,
        origen,
      });
    });
  }

  return result;
}

/**
 * Agrupa por ejecutivo a partir de la lista de seguimientos.
 */
export function agruparPorEjecutivo(
  items: SeguimientoReporteItem[]
): ResumenEjecutivo[] {
  const map = new Map<string, ResumenEjecutivo>();

  for (const it of items) {
    const uid = it.ejecutivoUID || "SIN_EJECUTIVO";
    if (!map.has(uid)) {
      map.set(uid, {
        ejecutivoUID: uid,
        total: 0,
        prejuridico: 0,
        juridico: 0,
        demanda: 0,
      });
    }
    const r = map.get(uid)!;
    r.total += 1;
    if (it.origen === "prejuridico") r.prejuridico += 1;
    if (it.origen === "juridico") r.juridico += 1;
    if (it.origen === "demanda") r.demanda += 1;
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

