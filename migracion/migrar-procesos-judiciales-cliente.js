/**
 * Migración de OBSERVACIONES (Demanda Cliente) por hoja
 * - Cada hoja: A1 => "NIT - Nombre"  (de aquí se extrae el NIT)
 * - Filas: Col A = ubicacion, ÚLTIMA columna = observacion
 * - Actualiza en: clientes/{uidCliente}/deudores/{deudorId}
 *                  campo: observacionesDemandaCliente
 *
 * Ajustes solicitados:
 * 1) Siempre ejecutar (se elimina DRY_RUN).
 * 2) Con NITs desde Excel (migracionXnit.xlsx), si un NIT no tiene hoja en el libro origen:
 *    registrar "NIT no tiene procesos judiciales".
 * 3) El reporte agrega filas al final, sin borrar las existentes.
 */

const admin = require("firebase-admin");
const xlsx = require("xlsx");
const fs = require("fs");

// --- Config ---
const excelPath = "./ProcesosJudicialesClientes.xlsx"; // libro origen (varias hojas, una por cliente)
const NITS_EXCEL_PATH = "./migracionXnit.xlsx";        // archivo con NITs a migrar
const OUTPUT_REPORTE = "./Reporte_ProcesosJudicialesClientes.xlsx";

// Firebase
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Utils
const toStr = (v) => (v === undefined || v === null) ? "" : String(v).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const digitsOnly = (s) => toStr(s).replace(/\D/g, "");

function parseNitFromTitleCell(valA1) {
  const s = toStr(valA1);
  if (!s) return "";
  let cleaned = s.trim().toUpperCase().replace(/^NIT[\s\.\-]*/i, "");
  const m = cleaned.match(/(\d+)/);
  return m ? m[1] : "";
}

// --- Helper: escribe con columnas ordenadas ---
function writeOrderedSheetFromJson(rows, order) {
  if (!rows || rows.length === 0) {
    return xlsx.utils.aoa_to_sheet([order]); // solo encabezado
  }
  const formatted = rows.map(row => {
    const obj = {};
    for (const key of order) obj[key] = row[key] ?? "";
    return obj;
  });
  return xlsx.utils.json_to_sheet(formatted, { header: order });
}

// (AJUSTE) Recibe "order" como parámetro para evitar scope issues
function appendOrderedJsonToSheet(wb, sheetName, rows, order) {
  if (!rows || rows.length === 0) return;
  const existing = wb.Sheets[sheetName]
    ? xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" })
    : [];

  const formatted = rows.map(row => {
    const obj = {};
    for (const key of order) obj[key] = row[key] ?? "";
    return obj;
  });

  if (existing.length === 0) {
    const sh = writeOrderedSheetFromJson(formatted, order);
    wb.Sheets[sheetName] = sh;
    xlsx.utils.book_append_sheet(wb, sh, sheetName);
  } else {
    xlsx.utils.sheet_add_json(wb.Sheets[sheetName], formatted, { origin: -1, skipHeader: true });
  }
}

// Lee NITs desde Excel (primera hoja). Busca columna "NIT"; si no existe, usa la primera columna.
function loadNitsSetFromExcel(path) {
  try {
    if (!fs.existsSync(path)) {
      console.warn(`⚠️  Archivo de NITs no encontrado: ${path}. Se migrarán todas las hojas (sin filtro).`);
      return null; // sin filtro
    }
    const wb = xlsx.readFile(path);
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      console.warn(`⚠️  ${path} no tiene hojas. Se migrarán todas las hojas (sin filtro).`);
      return null;
    }

    const mat = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
    if (mat.length === 0) {
      console.warn(`⚠️  ${path} está vacío. Se migrarán todas las hojas (sin filtro).`);
      return null;
    }

    let nitColIdx = 0;
    const headerRow = mat[0] || [];
    const foundIdx = headerRow.findIndex((c) => toStr(c).toLowerCase() === "nit");
    if (foundIdx >= 0) nitColIdx = foundIdx;

    const set = new Set();
    const startRow = (foundIdx >= 0) ? 1 : 0;

    for (let r = startRow; r < mat.length; r++) {
      const row = mat[r] || [];
      const nitRaw = row[nitColIdx];
      const norm = digitsOnly(nitRaw);
      if (norm) set.add(norm);
    }

    if (set.size === 0) {
      console.warn(`⚠️  ${path} no aportó NITs válidos. Se migrarán todas las hojas (sin filtro).`);
      return null;
    }

    console.log(`🗂️  NITs cargados desde ${path}: ${set.size}`);
    return set;
  } catch (err) {
    console.warn(`⚠️  No se pudo leer ${path}: ${err?.message || err}. Se migrarán todas las hojas (sin filtro).`);
    return null;
  }
}

async function getClienteUidByNit(nit) {
  const snap = await db.collection("usuarios")
    .where("numeroDocumento", "==", nit)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

async function getDeudorDocRefByUbicacion(uidCliente, ubicacion) {
  const snap = await db.collection("clientes")
    .doc(uidCliente)
    .collection("deudores")
    .where("ubicacion", "==", ubicacion)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].ref;
}

function withMotivo(row, motivo) {
  return { ...row, _motivo_no_migrado: motivo || "Motivo no especificado" };
}

function normalizeUbicacion(ubicacion) {
  if (!ubicacion) return ubicacion;
  let trimmed = ubicacion.trim();
  trimmed = trimmed.replace(/\s*[A-Za-z]$/, ""); // quita posibles letras sueltas al final (ej. “1A” → “1”)
  const firstChar = trimmed.charAt(0).toUpperCase();
  if (firstChar >= 'A' && firstChar <= 'Z') {
    const num = firstChar.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
    return num + trimmed.slice(1);
  }
  return trimmed;
}

// Helpers para APPEND en el reporte único
function ensureSheet(wb, name) {
  if (!wb.Sheets[name]) {
    const sh = xlsx.utils.aoa_to_sheet([]);
    xlsx.utils.book_append_sheet(wb, sh, name);
  }
}

function appendJsonToSheet(wb, sheetName, rows) {
  if (!rows || rows.length === 0) return;
  ensureSheet(wb, sheetName);
  const sh = wb.Sheets[sheetName];
  const existing = xlsx.utils.sheet_to_json(sh, { defval: "" });
  if (existing.length === 0) {
    wb.Sheets[sheetName] = xlsx.utils.json_to_sheet(rows);
  } else {
    xlsx.utils.sheet_add_json(sh, rows, { origin: -1, skipHeader: true });
  }
}

async function main() {
  // 1) Cargar NITs de filtro (si hay)
  const NITS_DESDE_EXCEL = loadNitsSetFromExcel(NITS_EXCEL_PATH);
  const usarFiltro = !!NITS_DESDE_EXCEL;

  // 2) Cargar el libro origen y construir índice NIT -> hoja
  const wb = xlsx.readFile(excelPath);
  const sheetsByNit = new Map();

  for (const sheetName of wb.SheetNames) {
    const sh = wb.Sheets[sheetName];
    if (!sh) continue;
    const nitRaw = parseNitFromTitleCell(sh["A1"]?.v);
    const nit = digitsOnly(nitRaw);
    if (!nit) continue; // NO registramos hojas sin A1 válido
    if (!sheetsByNit.has(nit)) {
      sheetsByNit.set(nit, { sheetName, sh });
    } else {
      console.warn(`⚠️  NIT ${nit} duplicado en hojas. Usando primera: ${sheetsByNit.get(nit).sheetName}, ignorando: ${sheetName}`);
    }
  }

  // 3) Determinar la lista de NITs a procesar
  const nitsAProcesar = usarFiltro
    ? Array.from(NITS_DESDE_EXCEL.values())               // SOLO los NITs del Excel de filtro
    : Array.from(sheetsByNit.keys());                     // si no hay filtro, procesar todas las hojas con NIT válido

  const okRows = [];
  const badRows = [];

  let migrados = 0;
  let noMigrados = 0;
  let nitSinHoja = 0;

  for (const nit of nitsAProcesar) {
    const entry = sheetsByNit.get(nit);
    if (!entry) {
      // (AJUSTE) Si no hay hoja para este NIT (con filtro activo o no), mensaje solicitado:
      badRows.push(withMotivo({ _sheet: null, _nit: nit }, `NIT no tiene procesos judiciales`));
      nitSinHoja++;
      continue;
    }

    const { sheetName, sh } = entry;

    // Leemos la hoja como matriz
    const matrix = xlsx.utils.sheet_to_json(sh, { header: 1, defval: "" });
    if (matrix.length < 2) {
      badRows.push(withMotivo({ _sheet: sheetName, _nit: nit }, "Hoja sin encabezados/filas"));
      noMigrados++;
      continue;
    }

    // Encabezado en fila 2 (índice 1); datos desde fila 3 (índice 2)
    const headerRow = matrix[1] || [];
    // última columna no vacía del header
    let lastColIdx = headerRow.length - 1;
    while (lastColIdx > 0 && toStr(headerRow[lastColIdx]) === "") lastColIdx--;

    // Buscar UID cliente una sola vez por hoja/NIT
    const uidCliente = await getClienteUidByNit(nit);
    if (!uidCliente) {
      badRows.push(withMotivo({ _sheet: sheetName, _nit: nit }, `Cliente no encontrado por NIT='${nit}'`));
      noMigrados++;
      continue;
    }

    for (let r = 2; r < matrix.length; r++) {
      const row = matrix[r] || [];
      const ubicacionRaw = toStr(row[0]);           // Columna A
      const ubicacion = normalizeUbicacion(ubicacionRaw);
      const observacion = toStr(row[lastColIdx]);   // Última columna

      if (!ubicacion && !observacion) continue;

      if (!ubicacion) {
        badRows.push(withMotivo(
          { _sheet: sheetName, _nit: nit, ubicacion, observacion },
          "Falta ubicacion (columna A)"
        ));
        noMigrados++;
        continue;
      }

      try {
        const deudorRef = await getDeudorDocRefByUbicacion(uidCliente, ubicacion);
        if (!deudorRef) {
          badRows.push(withMotivo(
            { _sheet: sheetName, _nit: nit, ubicacion, observacion },
            `Deudor no encontrado en clientes/${uidCliente}/deudores con ubicacion='${ubicacion}'`
          ));
          noMigrados++;
          continue;
        }

        // (AJUSTE) Siempre escribe (se elimina DRY_RUN)
        await deudorRef.set(
          { observacionesDemandaCliente: observacion },
          { merge: true }
        );

        okRows.push({
          _sheet: sheetName,
          _nit: nit,
          ubicacion,
          observacion,
          _deudorPath: deudorRef.path,
          _status: "OK",
        });
        migrados++;

        console.log(`✅ [${sheetName}] NIT=${nit} | ubicacion='${ubicacion}' → observación actualizada`);
        await sleep(10);
      } catch (err) {
        badRows.push(withMotivo(
          { _sheet: sheetName, _nit: nit, ubicacion, observacion },
          `Error inesperado: ${err?.message || String(err)}`
        ));
        noMigrados++;
        console.error(`❌ [${sheetName}] NIT=${nit} | ubicacion='${ubicacion}': ${err?.message || err}`);
      }
    }
  }

  // --- REPORTE FINAL (append) ---
  let reportWb;
  if (fs.existsSync(OUTPUT_REPORTE)) {
    reportWb = xlsx.readFile(OUTPUT_REPORTE);
  } else {
    reportWb = xlsx.utils.book_new();
  }

  // columnas en el orden deseado (AJUSTE: definido en alcance superior al helper)
  const order = ["_sheet", "_nit", "ubicacion", "observacion", "_motivo_no_migrado", "_deudorPath", "_status"];

  // aplicar helper con 'order'
  appendOrderedJsonToSheet(reportWb, "Migrados", okRows, order);
  appendOrderedJsonToSheet(reportWb, "NoMigrados", badRows, order);

  xlsx.writeFile(reportWb, OUTPUT_REPORTE);

  // Resumen
  console.log("────────────────────────────────────────");
  console.log(`✅ Migrados (filas): ${migrados}`);
  console.log(`⚠️  No migrados:     ${noMigrados}`);
  if (usarFiltro) console.log(`🔎 NITs del filtro sin hoja (no tienen procesos): ${nitSinHoja}`);
  console.log(`📁 Reporte:         ${OUTPUT_REPORTE}`);
  console.log("🚀 Proceso finalizado.");
}

main().catch((e) => {
  console.error("Error fatal:", e);
  process.exit(1);
});
