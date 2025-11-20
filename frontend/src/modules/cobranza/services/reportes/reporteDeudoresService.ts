// src/modules/cobranza/services/reportes/reporteDeudoresService.ts
import { db } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";
import type { FilaReporte } from "./tipos";

export async function obtenerReporteDeudoresPorAnio(
  clienteId: string,
  year: number
): Promise<FilaReporte[]> {
  const yearStr = String(year);

  const deudoresRef = collection(db, `clientes/${clienteId}/deudores`);
  const deudoresSnap = await getDocs(deudoresRef);

  const filasPromises = deudoresSnap.docs.map(async (deudorDoc) => {
    const d = deudorDoc.data() as any;
    const nombre = d?.nombre ?? "";
    const tipificacion = d?.tipificacion ?? "";
    const inmueble = d?.ubicacion ?? d?.inmueble ?? "";

    const estadosRef = collection(
      db,
      `clientes/${clienteId}/deudores/${deudorDoc.id}/estadosMensuales`
    );
    const estadosSnap = await getDocs(estadosRef);

    // Inicializar recaudado por mes
    const rec: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) rec[String(m).padStart(2, "0")] = 0;

    // 👇 este campo ahora será "Por Recaudar"
    let capitalEnero = 0;
    let ultimoMesConDatos: string | null = null; // "YYYY-MM"

    estadosSnap.forEach((mDoc) => {
      const data = mDoc.data() as { mes?: string; deuda?: number; recaudo?: number };
      const mesId = (data.mes || mDoc.id || "").trim(); // "YYYY-MM"

      // Solo meses del año seleccionado
      if (!mesId.startsWith(`${yearStr}-`)) return;

      const [, mm] = mesId.split("-");
      const deudaNum = Number(data.deuda ?? 0);
      const recVal = Number(data.recaudo ?? 0);

      // Acumular recaudo mensual
      if (Number.isFinite(recVal)) {
        rec[mm] = (rec[mm] ?? 0) + recVal;
      }

      // Determinar si este mes "tiene datos"
      const tieneDatos =
        (Number.isFinite(deudaNum) && deudaNum !== 0) ||
        (Number.isFinite(recVal) && recVal !== 0);

      // Si tiene datos y es más reciente que el último que teníamos, lo tomamos
      if (tieneDatos) {
        if (!ultimoMesConDatos || mesId > ultimoMesConDatos) {
          ultimoMesConDatos = mesId;
          capitalEnero = Number.isFinite(deudaNum) ? deudaNum : 0;
        }
      }
    });

    const recaudoTotal = Object.values(rec).reduce((a, b) => a + b, 0);

    const fila: FilaReporte = {
      tipificacion,
      inmueble,
      nombre,
      // 👇 ahora significa "Por Recaudar" (último mes con datos)
      capitalEnero,
      rec_01: rec["01"],
      rec_02: rec["02"],
      rec_03: rec["03"],
      rec_04: rec["04"],
      rec_05: rec["05"],
      rec_06: rec["06"],
      rec_07: rec["07"],
      rec_08: rec["08"],
      rec_09: rec["09"],
      rec_10: rec["10"],
      rec_11: rec["11"],
      rec_12: rec["12"],
      recaudoTotal,
    };

    return fila;
  });

  const filas = await Promise.all(filasPromises);

  filas.sort(
    (a, b) =>
      (a.tipificacion || "").localeCompare(b.tipificacion || "") ||
      (a.inmueble || "").localeCompare(b.inmueble || "")
  );

  return filas;
}
