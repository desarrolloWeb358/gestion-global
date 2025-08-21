// src/modules/cobranza/services/reportes/recaudosService.ts
import { db } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";

export interface MesTotal {
  mes: string;   // "YYYY-MM"
  total: number; // suma del campo 'recaudo' del mes para todos los deudores
}


//**
// * Recorre clientes/{clienteId}/deudores/*/estadosMensuales y
// * suma el campo 'recaudo' por cada documento mensual (id "YYYY-MM").
// */
export async function obtenerRecaudosMensuales(clienteId: string): Promise<MesTotal[]> {
  const deudoresRef = collection(db, `clientes/${clienteId}/deudores`);
  const deudoresSnap = await getDocs(deudoresRef);

  const acumulado = new Map<string, number>(); // mes => total

  // Por cada deudor, leer su subcolección 'estadosMensuales'
  for (const deudorDoc of deudoresSnap.docs) {
    const estadosRef = collection(
      db,
      `clientes/${clienteId}/deudores/${deudorDoc.id}/estadosMensuales`
    );
    const estadosSnap = await getDocs(estadosRef);

    estadosSnap.forEach((mDoc) => {
      const data = mDoc.data() as { mes?: string; recaudo?: number };
      const mesId = (data.mes || mDoc.id || "").trim(); // preferir campo 'mes' si existe
      if (!mesId) return;

      const valor = Number(data.recaudo ?? 0);
      if (!Number.isFinite(valor)) return;

      acumulado.set(mesId, (acumulado.get(mesId) || 0) + valor);
    });
  }

  // a) ordenar asc por YYYY-MM
  const ordenado = [...acumulado.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([mes, total]) => ({ mes, total }));

  return ordenado;
}
