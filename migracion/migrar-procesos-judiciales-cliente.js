/**
 * Migración de OBSERVACIONES (Demanda Cliente) por hoja
 * - Cada hoja: A1 => "NIT - Nombre"  (de aquí se extrae el NIT)
 * - Filas: Col A = ubicacion, ÚLTIMA columna = observacion
 * - Actualiza en: clientes/{uidCliente}/deudores/{deudorId}
 *                  campo: observacionesDemandaCliente
 */

const admin = require("firebase-admin");
const xlsx = require("xlsx");

// --- Config ---
const excelPath = "./ProcesosJudicialesClientes.xlsx"; // <-- tu archivo con varias hojas
const OUTPUT_MIGRADOS = "./ProcesosJudicialesClientes_migrados.xlsx";
const OUTPUT_NO_MIGRADOS = "./ProcesosJudicialesClientes_no_migrados.xlsx";
const DRY_RUN = false; // true = simula sin escribir    

// NEW: Lista opcional de NITs a migrar (dejar [] para migrar todo)
const NITS_FILTRADOS = [
  "901001861",
"900658412",
"900643491",
"900387627",
"830073688",
"830125131",
];

// Firebase
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Utils
const toStr = (v) => (v === undefined || v === null) ? "" : String(v).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// NEW: normaliza un NIT a solo dígitos
const digitsOnly = (s) => toStr(s).replace(/\D/g, "");

// NEW: versión normalizada del filtro (solo dígitos)
const NITS_FILTRADOS_NORM = (Array.isArray(NITS_FILTRADOS) ? NITS_FILTRADOS : [])
  .map(digitsOnly)
  .filter(Boolean);

function parseNitFromTitleCell(valA1) {
  const s = toStr(valA1);

  if (!s) return "";

  // Elimina prefijos "NIT", "NIT.", "NIT-" (con o sin espacios) al inicio
  let cleaned = s.trim().toUpperCase().replace(/^NIT[\s\.\-]*/i, "");

  // Busca la primera secuencia de dígitos dentro del string
  const m = cleaned.match(/(\d+)/);
  return m ? m[1] : "";
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
  trimmed = trimmed.replace(/\s*[A-Za-z]$/, "");
  const firstChar = trimmed.charAt(0).toUpperCase(); 
  if (firstChar >= 'A' && firstChar <= 'Z') {
    const num = firstChar.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
    return num + trimmed.slice(1);
  }
  return trimmed;
}

async function main() {
  const wb = xlsx.readFile(excelPath);
  const okRows = [];
  const badRows = [];

  let migrados = 0;
  let noMigrados = 0;
  let saltadosPorFiltro = 0; // NEW

  const usarFiltro = NITS_FILTRADOS_NORM.length > 0; // NEW


  for (const sheetName of wb.SheetNames) {
    const sh = wb.Sheets[sheetName];
    if (!sh) continue;

    // A1: "NIT - Nombre"
    const nit = parseNitFromTitleCell(sh["A1"]?.v);
    if (!nit) {
      badRows.push(withMotivo({ _sheet: sheetName }, "A1 no contiene NIT válido"));
      noMigrados++;
      continue;
    }

    // NEW: aplicar filtro de NITs si corresponde
    if (usarFiltro && !NITS_FILTRADOS_NORM.includes(digitsOnly(nit))) {
      console.log(`⏭️  [${sheetName}] NIT=${nit} omitido por filtro`);
      saltadosPorFiltro++;
      continue;
    }

    // Leemos toda la hoja como matriz (header:1)
    const matrix = xlsx.utils.sheet_to_json(sh, { header: 1, defval: "" });
    if (matrix.length < 2) {
      badRows.push(withMotivo({ _sheet: sheetName, _nit: nit }, "Hoja sin encabezados/filas"));
      noMigrados++;
      continue;
    }

    // Encabezado se asume en fila 2 (índice 1); datos desde fila 3 (índice 2)
    const headerRow = matrix[1] || [];
    // última columna no vacía del header
    let lastColIdx = headerRow.length - 1;
    while (lastColIdx > 0 && toStr(headerRow[lastColIdx]) === "") lastColIdx--;

    // Buscar UID cliente una sola vez por hoja
    const uidCliente = await getClienteUidByNit(nit);
    if (!uidCliente) {
      badRows.push(withMotivo({ _sheet: sheetName, _nit: nit }, `Cliente no encontrado por NIT='${nit}'`));
      noMigrados++;
      continue;
    }

    for (let r = 2; r < matrix.length; r++) {
      const row = matrix[r] || [];                     
      const ubicacionRaw = toStr(row[0]);         // Columna A
      const ubicacion = normalizeUbicacion(ubicacionRaw);
      const observacion = toStr(row[lastColIdx]);         // Última columna

      // Fila vacía → omitir silenciosamente
      if (!ubicacion && !observacion) continue;

      // Validaciones suaves
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

        if (!DRY_RUN) {
          await deudorRef.set(
            { observacionesDemandaCliente: observacion },
            { merge: true }
          );
        }

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

  // Salidas
  const okSheet = xlsx.utils.json_to_sheet(okRows);
  const okWb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(okWb, okSheet, "Migrados");
  xlsx.writeFile(okWb, OUTPUT_MIGRADOS);

  const badSheet = xlsx.utils.json_to_sheet(badRows);
  const badWb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(badWb, badSheet, "NoMigrados");
  xlsx.writeFile(badWb, OUTPUT_NO_MIGRADOS);

  console.log("────────────────────────────────────────");
  console.log(`✅ Migrados:     ${migrados}`);
  console.log(`⚠️  No migrados:  ${noMigrados}`);
  //console.log(`⏭️  Omitidos por filtro: ${saltadosPorFiltro}`); // NEW
  console.log(`📁 OK:           ${OUTPUT_MIGRADOS}`);
  console.log(`📁 Errores:      ${OUTPUT_NO_MIGRADOS}`);
  console.log("🚀 Proceso finalizado.");
}

main().catch((e) => {
  console.error("Error fatal:", e);
  process.exit(1);
});
