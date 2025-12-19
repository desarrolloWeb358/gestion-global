// src/modules/cobranza/services/reportes/reporteDeudoresService.ts
import { db } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";
import type { FilaReporte } from "./tipos";
import { TipificacionDeuda } from "../../../../shared/constants/tipificacionDeuda";

export async function obtenerReporteDeudoresPorAnio(
  clienteId: string,
  year: number
): Promise<FilaReporte[]> {
  const yearStr = String(year);

  const deudoresRef = collection(db, `clientes/${clienteId}/deudores`);
  const deudoresSnap = await getDocs(deudoresRef);

  const filasPromises = deudoresSnap.docs.map(async (deudorDoc) => {
    const d = deudorDoc.data() as any;

    const tipificacion = (d?.tipificacion ?? "").trim();

    // ✅ EXCLUIR INACTIVOS (y opcionalmente vacíos)
    if (tipificacion === TipificacionDeuda.INACTIVO) return null;
    // si también quieres excluir “sin tipificación”:
    // if (!tipificacion) return null;

    const nombre = d?.nombre ?? "";
    const inmueble = d?.ubicacion ?? d?.inmueble ?? "";

    const estadosRef = collection(
      db,
      `clientes/${clienteId}/deudores/${deudorDoc.id}/estadosMensuales`
    );
    const estadosSnap = await getDocs(estadosRef);

    const rec: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) rec[String(m).padStart(2, "0")] = 0;

    let porRecaudar = 0;
    let ultimoMesConDatos: string | null = null;

    estadosSnap.forEach((mDoc) => {
      const data = mDoc.data() as { mes?: string; deuda?: number; recaudo?: number };
      const mesId = (data.mes || mDoc.id || "").trim();
      if (!mesId.startsWith(`${yearStr}-`)) return;

      const [, mm] = mesId.split("-");
      const deudaNum = Number(data.deuda ?? 0);
      const recVal = Number(data.recaudo ?? 0);

      if (Number.isFinite(recVal)) rec[mm] = (rec[mm] ?? 0) + recVal;

      const tieneDatos =
        (Number.isFinite(deudaNum) && deudaNum !== 0) ||
        (Number.isFinite(recVal) && recVal !== 0);

      if (tieneDatos && (!ultimoMesConDatos || mesId > ultimoMesConDatos)) {
        ultimoMesConDatos = mesId;
        porRecaudar = Number.isFinite(deudaNum) ? deudaNum : 0;
      }
    });

    const recaudoTotal = Object.values(rec).reduce((a, b) => a + b, 0);

    const fila: FilaReporte = {
      tipificacion,
      inmueble,
      nombre,
      porRecaudar,
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

  const filasAll = await Promise.all(filasPromises);

  // ✅ quitar nulls
  const filas = filasAll.filter(Boolean) as FilaReporte[];

  filas.sort(
    (a, b) =>
      (a.tipificacion || "").localeCompare(b.tipificacion || "") ||
      (a.inmueble || "").localeCompare(b.inmueble || "")
  );

  return filas;
}
