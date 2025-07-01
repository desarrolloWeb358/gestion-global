// src/modules/cobranza/utils/procesarExcel.ts

import * as XLSX from "xlsx";
import { CuotaAcuerdo } from "../modules/cobranza/models/inmueble.model";

export const procesarExcel = async (
  file: File,
  porcentajeHonorarios: number
): Promise<CuotaAcuerdo[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        const cuotas: CuotaAcuerdo[] = (jsonData as any[]).map((row, index) => {
          const capital = parseFloat(row["cuota_capital"] || 0);
          const honorarios = parseFloat(((capital * porcentajeHonorarios) / 100).toFixed(2));
          const total = parseFloat((capital + honorarios).toFixed(2));

          return {
            numero: row["mes"] || `Cuota ${index + 1}`,
            fecha_limite: row["fecha_limite"] || "",
            deuda_capital: capital,
            cuota_capital: capital,
            deuda_honorarios: honorarios,
            honorarios,
            cuota_acuerdo: total,
            pagado: false,
          };
        });

        resolve(cuotas);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};
