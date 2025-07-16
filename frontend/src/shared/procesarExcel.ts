import * as XLSX from "xlsx";
import type { Cuota } from "../modules/cobranza/models/inmueble.model";

const REQUIRED_COLUMNS = [
  "numero_cuota",
  "fecha_limite",
  "deuda_capital",
  "cuota_capital",
  "deuda_honorarios",
  "cuota_honorarios",
];

export async function procesarExcel(
  file: File,
  porcentajeHonorarios: number
): Promise<Cuota[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = e.target?.result;
      if (!data) return reject("No se pudo leer el archivo");

      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];

      if (json.length === 0) return reject("El archivo está vacío");

      const firstRow = Object.keys(json[0]);
      const missing = REQUIRED_COLUMNS.filter((col) => !firstRow.includes(col));
      if (missing.length > 0) {
        return reject(`Faltan columnas obligatorias: ${missing.join(", ")}`);
      }

      const cuotas: Cuota[] = json.map((row, index) => {
        const fecha = new Date(row.fecha_limite);
        const fecha_limite = isNaN(fecha.getTime())
          ? "Fecha inválida"
          : fecha.toISOString().split("T")[0];

        const deuda_capital = Number(row.deuda_capital) || 0;
        const cuota_capital = Number(row.cuota_capital) || 0;
        const deuda_honorarios = Number(row.deuda_honorarios) || 0;
        const honorarios = row.cuota_honorarios !== undefined
          ? Number(row.cuota_honorarios)
          : deuda_honorarios * porcentajeHonorarios;

        const cuota_acuerdo = cuota_capital + honorarios;

        return {
          numero: String(row.numero_cuota).trim(),
          fecha_limite,
          deuda_capital,
          cuota_capital,
          deuda_honorarios,
          honorarios,
          cuota_acuerdo,
          pagado: false,
          mes: row.mes || `Cuota ${index + 1}`, // ✅ default mes si no hay
          valor_esperado: cuota_acuerdo,        // ✅ requerido por el tipo Cuota
          observacion: row.observacion || "",    // ✅ opcional pero requerido por el tipo
        };
      });

      resolve(cuotas);
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}
