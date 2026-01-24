// src/modules/cobranza/services/reportes/recaudosService.ts
import { db } from "@/firebase";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";

export interface MesTotal {
  mes: string;   // "YYYY-MM"
  total: number; // suma del campo 'recaudo' del mes para todos los deudores
}

function toDateSafe(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "object" && typeof v.seconds === "number") return new Date(v.seconds * 1000);
  return null;
}

function isTerminadoDentroDelAnio(fechaTerminado: any, year: number): boolean {
  const f = toDateSafe(fechaTerminado);
  if (!f) return false;
  const inicio = new Date(year, 0, 1);
  const fin = new Date(year + 1, 0, 1);
  return f >= inicio && f < fin;
}

/**
 * Suma 'recaudo' por mes (id o campo 'mes' = "YYYY-MM") para TODOS los deudores del cliente,
 * PERO únicamente del año en curso (enero → mes actual).
 * - Paraleliza la lectura de subcolecciones 'estadosMensuales' por deudor.
 * - Rellena meses sin datos con total = 0.
 */
export async function obtenerRecaudosMensuales(
  clienteId: string,
  year: number,
  month: number
): Promise<MesTotal[]> {
  const yearStr = String(year);
  const currentMonth = month; // 1..12

  const acumulado = new Map<string, number>();
  for (let m = 1; m <= currentMonth; m++) {
    const mm = String(m).padStart(2, "0");
    acumulado.set(`${yearStr}-${mm}`, 0);
  }

  const deudoresRef = collection(db, `clientes/${clienteId}/deudores`);
  const deudoresSnap = await getDocs(deudoresRef);

  const estadosPromises = deudoresSnap.docs.map(async (deudorDoc) => {
    const estadosRef = collection(db, `clientes/${clienteId}/deudores/${deudorDoc.id}/estadosMensuales`);
    return getDocs(estadosRef);
  });

  const estadosSnaps = await Promise.all(estadosPromises);

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

