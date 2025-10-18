// src/modules/cobranza/services/reportes/recaudosService.ts
import { db } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";

export interface MesTotal {
  mes: string;   // "YYYY-MM"
  total: number; // suma del campo 'recaudo' del mes para todos los deudores
}

/**
 * Suma 'recaudo' por mes (id o campo 'mes' = "YYYY-MM") para TODOS los deudores del cliente,
 * PERO únicamente del año en curso (enero → mes actual).
 * - Paraleliza la lectura de subcolecciones 'estadosMensuales' por deudor.
 * - Rellena meses sin datos con total = 0.
 */
export async function obtenerRecaudosMensuales(clienteId: string): Promise<MesTotal[]> {
  const ahora = new Date();
  const year = ahora.getFullYear();
  const yearStr = String(year);
  const currentMonth = ahora.getMonth() + 1; // 1..12

  // Preseed de meses "YYYY-MM" desde 01 hasta el mes actual
  const acumulado = new Map<string, number>();
  for (let m = 1; m <= currentMonth; m++) {
    const mm = String(m).padStart(2, "0");
    acumulado.set(`${yearStr}-${mm}`, 0);
  }

  // 1) Traer todos los deudores del cliente
  const deudoresRef = collection(db, `clientes/${clienteId}/deudores`);
  const deudoresSnap = await getDocs(deudoresRef);

  // 2) Leer en paralelo la subcolección 'estadosMensuales' de cada deudor
  const estadosPromises = deudoresSnap.docs.map((deudorDoc) => {
    const estadosRef = collection(
      db,
      `clientes/${clienteId}/deudores/${deudorDoc.id}/estadosMensuales`
    );
    return getDocs(estadosRef);
  });

  const estadosSnaps = await Promise.all(estadosPromises);

  // 3) Acumular solo los meses del año en curso (y no más allá del mes actual)
  for (const estadosSnap of estadosSnaps) {
    estadosSnap.forEach((mDoc) => {
      const data = mDoc.data() as { mes?: string; recaudo?: number };
      // Preferir campo 'mes'; si no, usar el id del doc
      const rawMes = (data.mes || mDoc.id || "").trim(); // esperado "YYYY-MM"
      if (!rawMes || rawMes.length < 7) return;

      // Filtrar por año en curso
      const esDelAnio = rawMes.startsWith(`${yearStr}-`);
      if (!esDelAnio) return;

      // Evitar meses futuros (p.ej. si existe "YYYY-12" pero estamos en abril)
      const [, mmStr] = rawMes.split("-");
      const mm = Number(mmStr);
      if (!Number.isFinite(mm) || mm < 1 || mm > currentMonth) return;

      const claveMes = `${yearStr}-${mmStr.padStart(2, "0")}`;
      const valor = Number(data.recaudo ?? 0);
      if (!Number.isFinite(valor)) return;

      acumulado.set(claveMes, (acumulado.get(claveMes) || 0) + valor);
    });
  }

  // 4) Devolver ordenado asc por "YYYY-MM" (preseed ya garantiza la presencia de todos los meses)
  const ordenado = [...acumulado.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([mes, total]) => ({ mes, total }));

  return ordenado;
}
