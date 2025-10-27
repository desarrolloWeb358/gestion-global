/**
 * Migración de PROCESOS JUDICIALES desde Excel a Firestore
 *
 * Excel (encabezados sugeridos, orden de columnas):
 *   1) ejecutivo            (p.ej., "nicoll", "laura")
 *   2) nit                  (NIT del cliente, string o número)
 *   3) ubicacion            (string exacto a buscar en deudores.ubicacion)
 *   4) demandados
 *   5) juzgado
 *   6) numero_radicado
 *   7) localidad
 *   8) observaciones
 */

const admin = require("firebase-admin");
const xlsx = require("xlsx");

const fs = require("fs");

// --- Config ---

// 👇 Nuevo: un solo archivo de reporte
const OUTPUT_REPORTE = "./Reporte_ProcesosJudiciales.xlsx";
// --- Config ---
const excelPath = "./ProcesosJudiciales.xlsx";                // <-- cambia si es necesario
const DRY_RUN = false; // true = no escribe, solo simula

// 📂 Archivo externo con NITs a migrar (si está vacío o no existe → migra TODOS)
const NITS_EXCEL_PATH = "./migracionXnit.xlsx";

// Mapeo ejecutivo -> UID (case-insensitive)
const EJECUTIVOS_UID = {
  // claves en minúscula
  nicoll: "FWn2ELTvlSSDxnrvoAkBGewzBr43",
  laura: "TkBWDCsUzjNCwdu5q8cXciSQqmQ2",
  // agrega más si aparecen en tu Excel...
};

// Inicializa Firebase Admin
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

/** Utils */
const toStr = (v) => (v === undefined || v === null) ? "" : String(v).trim();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Normaliza NIT: deja solo dígitos (quita puntos, guiones, espacios, prefijos tipo "NIT", etc.)
const normalizeNit = (nitRaw) => {
  if (!nitRaw) return "";
  const s = String(nitRaw).toUpperCase();
  return s.replace(/[^\d]/g, "");
};


function appendOrCreateReport(filePath, okRows, badRows) {
  // Abrir si existe, o crear nuevo
  const wb = fs.existsSync(filePath) ? xlsx.readFile(filePath) : xlsx.utils.book_new();

  // Asegurar nombres de hojas
  const OK_SHEET = "Migrados";
  const BAD_SHEET = "NoMigrados";

  // Leer filas existentes (si las hojas existen)
  const okSheetExisting = wb.Sheets[OK_SHEET];
  const badSheetExisting = wb.Sheets[BAD_SHEET];

  const existingOkRows = okSheetExisting
    ? xlsx.utils.sheet_to_json(okSheetExisting, { defval: "" })
    : [];
  const existingBadRows = badSheetExisting
    ? xlsx.utils.sheet_to_json(badSheetExisting, { defval: "" })
    : [];

  // Concatenar (append)
  const mergedOk = existingOkRows.concat(okRows);
  const mergedBad = existingBadRows.concat(badRows);

  // Re-crear hojas desde el merge
  const okSheetNew = xlsx.utils.json_to_sheet(mergedOk);
  const badSheetNew = xlsx.utils.json_to_sheet(mergedBad);

  // Reemplazar/crear en el workbook
  wb.Sheets[OK_SHEET] = okSheetNew;
  wb.Sheets[BAD_SHEET] = badSheetNew;

  // Asegurar orden de pestañas: Migrados primero, NoMigrados segundo
  const desiredOrder = [OK_SHEET, BAD_SHEET];
  wb.SheetNames = desiredOrder;

  // Guardar
  xlsx.writeFile(wb, filePath);
}

// 📥 Carga Set de NITs desde migracionXnit.xls (primera hoja).
// Acepta encabezados comunes (nit/NIT/cliente/numeroDocumento). Si no hay, toma el primer campo de la fila.
function loadNitFilterSet(filePath) {
  try {
    const wb = xlsx.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    // leemos como objetos para intentar por nombre de columna
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });
    const set = new Set();

    for (const r of rows) {
      // candidatos por nombre de encabezado
      const candidatesByName = [
        r.nit, r.Nit, r.NIT,
        r.numeroDocumento, r.NUMERODOCUMENTO, r.NumeroDocumento,
        r.cliente, r.CLIENTE, r.Cliente,
      ];
      let picked = candidatesByName.find(v => toStr(v));
      if (!picked) {
        // como fallback: primera celda de la fila (por si vino sin encabezados)
        const firstValue = Object.values(r)[0];
        picked = toStr(firstValue);
      }
      const norm = normalizeNit(picked);
      if (norm) set.add(norm);
    }

    return set;
  } catch (e) {
    console.warn(`ℹ️  No se pudo cargar '${filePath}' (${e.message}). Se migrarán TODOS los NIT del Excel principal.`);
    return new Set(); // vacío = sin filtro → migra todos
  }
}

// Busca el UID del cliente a partir del NIT en `usuarios`
async function getClienteUidByNit(nit) {
  const snap = await db
    .collection("usuarios")
    .where("numeroDocumento", "==", nit)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

// Busca el deudor por `ubicacion` dentro de clientes/{uidCliente}/deudores
async function getDeudorDocRefByUbicacion(uidCliente, ubicacion) {
  const snap = await db
    .collection("clientes")
    .doc(uidCliente)
    .collection("deudores")
    .where("ubicacion", "==", ubicacion)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].ref;
}

// Clona el objeto de la fila y añade el motivo al final (última columna)
function withMotivoNoMigrado(row, motivo) {
  const out = { ...row };
  out._motivo_no_migrado = motivo || "Motivo no especificado";
  return out;
}

// Convierte una letra inicial en número (A=1, B=2, ... Z=26)
function normalizeUbicacion(ubicacion) {
  if (!ubicacion) return ubicacion;

  // Trim inicial
  let trimmed = ubicacion.trim();

  // 1) Quitar una letra final si existe (con o sin espacio antes)
  trimmed = trimmed.replace(/\s*[A-Za-z]$/, "");

  // Si empieza con letra de A-Z → la convierte a número y concatena lo que sigue
  const firstChar = trimmed.charAt(0).toUpperCase();
  if (firstChar >= 'A' && firstChar <= 'Z') {
    const num = firstChar.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
    return num + trimmed.slice(1);
  }

  return trimmed;
}

// Bogotá no usa DST; offset fijo
const TIMEZONE_OFFSET_HOURS = -5;

// Devuelve una Date en "medianoche" local de Bogotá (00:00 -05 → 05:00 UTC)
function toBogotaMidnight(dateUTCOrLocal) {
  const y = dateUTCOrLocal.getUTCFullYear();
  const m = dateUTCOrLocal.getUTCMonth();
  const d = dateUTCOrLocal.getUTCDate();
  return new Date(Date.UTC(y, m, d, -TIMEZONE_OFFSET_HOURS, 0, 0));
}

function parseFechaUltimaRevision(value) {
  if (value === undefined || value === null || value === "") return null;

  // a) Date nativa
  if (value instanceof Date && !isNaN(value)) {
    return toBogotaMidnight(value);
  }

  // b) Serial Excel (número)
  const asNumber = Number(value);
  if (!Number.isNaN(asNumber) && Number.isFinite(asNumber)) {
    const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30, 0, 0, 0); // 1899-12-30
    const ms = Math.round(asNumber * 24 * 60 * 60 * 1000);
    const utcDate = new Date(EXCEL_EPOCH_UTC_MS + ms); // medianoche UTC del día
    return toBogotaMidnight(utcDate);
  }

  // c) Texto "DD-MM-AAAA" (o con / .)
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (!m) return null;

  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  return new Date(Date.UTC(year, month - 1, day, -TIMEZONE_OFFSET_HOURS, 0, 0));
}

async function main() {
  let migrados = 0;
  let noMigrados = 0;

  // 📥 Cargar filtro de NITs desde migracionXnit.xls
  const NITS_FILTRAR_SET = loadNitFilterSet(NITS_EXCEL_PATH);

  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  console.log(`📄 ${rows.length} filas leídas de ${excelPath}`);
  if (NITS_FILTRAR_SET.size > 0) {
    console.log(`🎯 Filtrando por ${NITS_FILTRAR_SET.size} NIT(s) específicos (desde ${NITS_EXCEL_PATH})...`);
  } else {
    console.log(`ℹ️  No se cargó filtro de NIT (o está vacío) → se migrarán TODOS los NIT del Excel principal.`);
  }

  const okRows = [];      // para OUTPUT_MIGRADOS
  const badRows = [];     // para OUTPUT_NO_MIGRADOS

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];

    // Lectura tolerante de encabezados
    const ejecutivoRaw = toStr(raw.ejecutivo || raw.Ejecutivo || raw.EJECUTIVO);
    const nit = normalizeNit(toStr(raw.nit || raw.Nit || raw.NIT || raw.CLIENTE || raw.cliente));
    let ubicacion = toStr(raw.ubicacion || raw.UBICACIÓN || raw.UBICACION);
    // Normalizar ubicación si empieza con letra
    ubicacion = normalizeUbicacion(ubicacion);

    const demandados = toStr(raw.demandados || raw.Demandados || raw.DEMANDADOS);
    const juzgado = toStr(raw.juzgado || raw.Juzgado || raw.JUZGADO);
    const numeroRadicado = toStr(
      raw.numero_radicado ||
      raw["numero radicado"] ||
      raw["NUMERO RADICADO"] ||
      raw.Numero_Radicado ||
      raw.NumeroRadicado ||
      raw.NUMERO_RADICADO
    );
    const localidad = toStr(raw.localidad || raw.Localidad || raw.LOCALIDAD);
    const observaciones = toStr(raw.observaciones || raw.Observaciones || raw.OBSERVACIONES);

    const fechaUltRevRaw = toStr(
      raw["FECHA DE ULTIMA REVISION"] ||
      raw["FECHA DE LA ULTIMA REVISION"] ||
      raw["FECHA DE ULTIMA REVISION DEL EXPEDIENTE DIGITAL"] ||
      raw["fecha_ultima_revision"] ||
      raw["fechaUltimaRevision"] ||
      raw["FechaUltimaRevision"] ||
      raw["FECHA_ULTIMA_REVISION"]
    );

    // 🎯 Filtro por NITs solicitados (si se cargó alguno)
    if (NITS_FILTRAR_SET.size > 0 && !NITS_FILTRAR_SET.has(nit)) {
      // omitido por filtro → no lo contamos como error
      continue;
    }

    // Validaciones suaves (NO throw)
    if (!nit) {
      badRows.push(withMotivoNoMigrado(raw, "Falta NIT (columna 2)"));
      noMigrados++;
      console.warn(`⚠️  [${i + 1}] Fila sin NIT.`);
      continue;
    }
    if (!ubicacion) {
      badRows.push(withMotivoNoMigrado(raw, "Falta ubicacion (columna 3)"));
      noMigrados++;
      console.warn(`⚠️  [${i + 1}] Falta ubicacion para NIT=${nit}.`);
      continue;
    }

    try {
      // 1) Mapear ejecutivo
      let uidEjecutivo = "";
      if (ejecutivoRaw) {
        const key = ejecutivoRaw.toLowerCase();
        uidEjecutivo = EJECUTIVOS_UID[key] || "";
        if (!uidEjecutivo) {
          badRows.push(withMotivoNoMigrado(raw, `Ejecutivo '${ejecutivoRaw}' sin mapeo de UID`));
          noMigrados++;
          console.warn(`⚠️  [${i + 1}] Ejecutivo desconocido: '${ejecutivoRaw}'.`);
          continue;
        }
      } else {
        badRows.push(withMotivoNoMigrado(raw, "Falta ejecutivo"));
        noMigrados++;
        console.warn(`⚠️  [${i + 1}] Falta ejecutivo para NIT=${nit}.`);
        continue;
      }

      // 2) Buscar UID del cliente por NIT
      const uidCliente = await getClienteUidByNit(nit);
      if (!uidCliente) {
        badRows.push(withMotivoNoMigrado(raw, `Cliente no encontrado en 'usuarios' por NIT='${nit}'`));
        noMigrados++;
        console.warn(`⚠️  [${i + 1}] Cliente no encontrado por NIT=${nit}.`);
        continue;
      }

      // 3) Actualizar cliente con ejecutivoJuridicoId
      if (!DRY_RUN) {
        await db.collection("clientes").doc(uidCliente).set(
          { ejecutivoJuridicoId: uidEjecutivo },
          { merge: true }
        );
      }

      // 4) Localizar deudor por 'ubicacion'
      const deudorRef = await getDeudorDocRefByUbicacion(uidCliente, ubicacion);
      if (!deudorRef) {
        badRows.push(withMotivoNoMigrado(
          raw,
          `Deudor no encontrado en clientes/${uidCliente}/deudores con ubicacion='${ubicacion}'`
        ));
        noMigrados++;
        console.warn(`⚠️  [${i + 1}] Deudor no encontrado (NIT=${nit}, ubicacion='${ubicacion}').`);
        continue;
      }

      // 5) Actualizar campos judiciales del deudor
      const updateDeudor = { demandados, juzgado, numeroRadicado, localidad, observacionesDemanda: observaciones };
      // Parseo y agregado de la fecha de última revisión si viene válida
      //console.log(`    → Parseando fecha última revisión: '${fechaUltRevRaw}'`);
      const parsedDate = parseFechaUltimaRevision(fechaUltRevRaw);
      //console.log(`    → Fecha última revisión raw='${fechaUltRevRaw}' parsed=${parsedDate}`);
      if (parsedDate) {
        updateDeudor.fechaUltimaRevision = admin.firestore.Timestamp.fromDate(parsedDate);
      } else {
        console.warn(`    ⚠️ Fecha última revisión inválida/ausente para NIT=${nit}, ubicacion='${ubicacion}'`);
      }

      if (!DRY_RUN) await deudorRef.set(updateDeudor, { merge: true });

      // éxito → empuja la misma fila original + metadatos opcionales
      okRows.push({
        ...raw,
        _uidCliente: uidCliente,
        _ejecutivo_uid: uidEjecutivo,
        _deudorPath: deudorRef.path,
        _status: "OK",
      });
      migrados++;

      console.log(`✅ [${i + 1}/${rows.length}] NIT=${nit} | ubicacion='${ubicacion}' → actualizado (${deudorRef.path})`);

      // Evitar picos de cuota
      await sleep(15);
    } catch (err) {
      const motivo = err?.message || String(err);
      badRows.push(withMotivoNoMigrado(raw, `Error inesperado: ${motivo}`));
      noMigrados++;
      console.error(`❌ [${i + 1}] Error inesperado: ${motivo}`);
    }
  }

  // Escribir MIGRADOS
  const okSheet = xlsx.utils.json_to_sheet(okRows);
  const okWb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(okWb, okSheet, "Migrados");
  //xlsx.writeFile(okWb, OUTPUT_MIGRADOS);

  // Escribir NO MIGRADOS
  const badSheet = xlsx.utils.json_to_sheet(badRows);
  const badWb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(badWb, badSheet, "NoMigrados");
  //xlsx.writeFile(badWb, OUTPUT_NO_MIGRADOS);

  // 🧾 Único archivo de reporte con 2 pestañas y APPEND si ya existe
  appendOrCreateReport(OUTPUT_REPORTE, okRows, badRows);

  console.log("────────────────────────────────────────");
  console.log(`✅ Migrados:     ${migrados}`);
  console.log(`⚠️  No migrados:  ${noMigrados}`);
  console.log(`📁 Reporte:      ${OUTPUT_REPORTE}`);
  console.log("🚀 Proceso finalizado.");
}

main().catch((e) => {
  console.error("Error fatal:", e);
  process.exit(1);
});
