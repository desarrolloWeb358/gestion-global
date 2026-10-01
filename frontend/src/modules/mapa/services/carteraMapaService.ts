import { collectionGroup, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase";

/**
 * Cartera de cada conjunto según SU último mes cargado. Los meses se cargan
 * por partes (en sep-2026: septiembre 22 conjuntos, agosto 51, julio 74), así
 * que "la cartera de este mes" dejaría a la mayoría en cero solo por no estar
 * cargados todavía. Misma fuente que el reporte de recaudo (`estadosMensuales`).
 */
export interface CarteraConjunto {
  mes: string; // último mes cargado, "AAAA-MM"
  deuda: number;
  recaudo: number;
  deudoresConDeuda: number;
}

/** Cuántos meses hacia atrás se miran; lo más viejo se considera "sin dato reciente". */
export const MESES_VENTANA = 6;

export async function cargarCarteraReciente(): Promise<Map<string, CarteraConjunto>> {
  const meses = mesesRecientes(MESES_VENTANA);
  const desde = meses[meses.length - 1];
  const hasta = meses[0];
  const snap = await getDocs(
    query(collectionGroup(db, "estadosMensuales"), where("mes", ">=", desde), where("mes", "<=", hasta))
  );
  // clienteId → mes → acumulado
  const porConjunto = new Map<string, Map<string, CarteraConjunto>>();
  snap.forEach((d) => {
    const x = d.data() as { mes?: string; clienteUID?: string; deuda?: number; recaudo?: number };
    const mes: string = x.mes || d.id;
    // clientes/{clienteId}/deudores/{deudorId}/estadosMensuales/{mes}
    const clienteId: string | undefined = x.clienteUID || d.ref.parent.parent?.parent.parent?.id;
    if (!clienteId || !mes) return;
    const deuda = Number(x.deuda ?? 0) || 0;
    const porMes = porConjunto.get(clienteId) ?? new Map<string, CarteraConjunto>();
    const r = porMes.get(mes) ?? { mes, deuda: 0, recaudo: 0, deudoresConDeuda: 0 };
    r.deuda += deuda;
    r.recaudo += Number(x.recaudo ?? 0) || 0;
    if (deuda > 0) r.deudoresConDeuda += 1;
    porMes.set(mes, r);
    porConjunto.set(clienteId, porMes);
  });
  const ultimo = new Map<string, CarteraConjunto>();
  porConjunto.forEach((porMes, clienteId) => {
    const mes = [...porMes.keys()].sort().pop()!;
    ultimo.set(clienteId, porMes.get(mes)!);
  });
  return ultimo;
}

/** "2026-09" y los 5 meses anteriores, del más reciente al más viejo. */
export function mesesRecientes(cantidad = 6): string[] {
  const hoy = new Date();
  return Array.from({ length: cantidad }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export function nombreMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} ${a}`;
}

/** $ 12,3 M · $ 850 mil · $ 0 */
export function pesosCortos(v: number): string {
  if (v >= 1_000_000) return `$ ${(v / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
  if (v >= 1_000) return `$ ${Math.round(v / 1_000).toLocaleString("es-CO")} mil`;
  return `$ ${Math.round(v).toLocaleString("es-CO")}`;
}

/**
 * Niveles por cuartiles de la cartera de los conjuntos visibles: se adaptan a
 * los datos reales en vez de umbrales fijos que envejecen.
 */
export type NivelCartera = "sin" | "baja" | "media" | "alta" | "muy_alta";
export const NIVELES_CARTERA: { id: NivelCartera; label: string; color: string }[] = [
  { id: "muy_alta", label: "Muy alta", color: "#7f1d1d" },
  { id: "alta", label: "Alta", color: "#dc2626" },
  { id: "media", label: "Media", color: "#f97316" },
  { id: "baja", label: "Baja", color: "#eab308" },
  { id: "sin", label: "Sin cartera reciente", color: "#9ca3af" },
];

export function cortesCuartiles(valores: number[]): [number, number, number] {
  const v = valores.filter((x) => x > 0).sort((a, b) => a - b);
  if (v.length === 0) return [0, 0, 0];
  const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return [q(0.25), q(0.5), q(0.75)];
}

export function nivelDe(deuda: number, cortes: [number, number, number]): NivelCartera {
  if (!(deuda > 0)) return "sin";
  if (deuda >= cortes[2]) return "muy_alta";
  if (deuda >= cortes[1]) return "alta";
  if (deuda >= cortes[0]) return "media";
  return "baja";
}
