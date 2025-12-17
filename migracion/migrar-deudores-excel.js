/* eslint-disable no-console */
const admin = require("firebase-admin");
const xlsx = require("xlsx");
const path = require("path");
const fs = require("fs");

// =====================
// Firebase Admin
// =====================
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// =====================
// Archivos
// =====================
const excelPath = process.env.INPUT || "./nuevosDeudores.xlsx";
const OUT_FILE = path.resolve(process.cwd(), "reporte_migracion_deudores.xlsx");

// =====================
// Tipificaciones válidas
// =====================
const TIPIFICACIONES_VALIDAS = [
  "Devuelto",
  "Terminado",
  "Acuerdo",
  "Gestionando",
  "Demanda",
  "Demanda/Acuerdo",
  "Demanda/Terminado",
  "Inactivo",
  "Prejurídico/Insolvencia",
  "Demanda/Insolvencia",
];

function normKey(v) {
  return String(v || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const TIP_MAP = new Map(TIPIFICACIONES_VALIDAS.map((t) => [normKey(t), t]));
(function addAliases() {
  for (const t of TIPIFICACIONES_VALIDAS) {
    TIP_MAP.set(normKey(t.replace(/\s*\/\s*/g, "/")), t);
    TIP_MAP.set(normKey(t.replace(/\//g, " / ")), t);
    TIP_MAP.set(normKey(t.replace(/-/g, "/")), t);
  }
})();

function normalizeTipificacion(input) {
  const k = normKey(input);
  return TIP_MAP.get(k) || null;
}

// =====================
// Helpers parseo Excel
// =====================
function parseNitAndMesFromFirstRow(a1Value) {
  const raw = String(a1Value || "").trim();
  const parts = raw.split(/\s+/);
  const nit = (parts[0] || "").trim();
  const mes = (parts[1] || "").trim();

  if (!nit) throw new Error("FALTA_NIT_EN_FILA_1 (A1)");
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    throw new Error(`MES_INVALIDO_EN_FILA_1 (esperado AAAA-MM): "${mes}"`);
  }
  return { nit, mes };
}

function headerIndexMap(headerRow) {
  const headers = (headerRow || []).map((h) => String(h || "").trim());
  const low = headers.map((h) => normKey(h));

  const idx = (name) => low.indexOf(normKey(name));

  return {
    tipificacion: idx("tipificación") !== -1 ? idx("tipificación") : idx("tipificacion"),
    ubicacion: idx("ubicación") !== -1 ? idx("ubicación") : idx("ubicacion"),
    nombre: idx("nombre"),
    telefonos: idx("teléfonos") !== -1 ? idx("teléfonos") : idx("telefonos"),
    correos: idx("correos"),
    deuda: idx("deuda"),
    honorarios: idx("honorarios"),
    porcentaje: idx("porcentaje"),
    _headers: headers,
  };
}

function splitCsvToArray(v) {
  const s = String(v || "").trim();
  if (!s) return [];
  return s
    .split(",")
    .map((x) => String(x).trim())
    .filter(Boolean);
}

function parseNumber(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;

  const s = String(v)
    .trim()
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(/,(\d{1,2})$/, ".$1");

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// =====================
// Reporte Excel
// =====================
function loadOrCreateWorkbook(filePath) {
  if (fs.existsSync(filePath)) {
    try { return xlsx.readFile(filePath); } catch (e) {}
  }
  return xlsx.utils.book_new();
}

function appendRowsToSheet(wb, sheetName, rows) {
  if (!rows || rows.length === 0) return;
  let ws = wb.Sheets[sheetName];
  if (!ws) {
    ws = xlsx.utils.json_to_sheet(rows);
    xlsx.utils.book_append_sheet(wb, ws, sheetName);
    return;
  }
  xlsx.utils.sheet_add_json(ws, rows, { origin: -1, skipHeader: true });
}

// =====================
// Firestore lookup
// =====================
async function findClienteUidByNit(nit) {
  const snap = await db
    .collection("usuarios")
    .where("roles", "array-contains", "cliente")
    .where("numeroDocumento", "==", String(nit).trim())
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].id;
}

// =====================
// MAIN
// =====================
(async function main() {
  const resumen = [];
  const filasOK = [];
  const filasError = [];
  const tipificacionesInvalidas = [];

  try {
    const wb = xlsx.readFile(excelPath, { cellDates: false });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    const aoa = xlsx.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (!aoa || aoa.length < 3) throw new Error("EXCEL_INVALIDO: Debe tener mínimo 3 filas (A1, headers, data)");

    // 1) NIT + MES desde fila 1 (A1)
    const { nit, mes } = parseNitAndMesFromFirstRow((aoa[0] || [])[0]);

    // 2) Índices de headers desde fila 2
    const h = headerIndexMap(aoa[1] || []);

    const required = ["tipificacion", "ubicacion", "nombre", "telefonos", "correos", "deuda", "honorarios", "porcentaje"];
    for (const k of required) {
      if (h[k] === -1 || h[k] === undefined) {
        throw new Error(`FALTA_COLUMNA_EN_HEADERS: "${k}" (fila 2)`);
      }
    }

    console.log(`📄 Archivo: ${path.resolve(excelPath)}`);
    console.log(`🏷️ NIT=${nit}  MES=${mes}`);

    // 3) Resolver clienteUID por NIT
    const clienteUID = await findClienteUidByNit(nit);
    if (!clienteUID) throw new Error(`CLIENTE_NO_ENCONTRADO_EN_USUARIOS: NIT=${nit}`);

    console.log(`✅ clienteUID encontrado: ${clienteUID}`);

    // 4) Asegurar clientes/{clienteUID}
    await db.collection("clientes").doc(clienteUID).set(
      { fechaActualizacion: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    const dataRows = aoa.slice(2);
    console.log(`📌 Filas de deudores a procesar: ${dataRows.length}`);

    // 5) Batch (500 ops máx). Cada fila hace 2 escrituras
    let batch = db.batch();
    let opCount = 0;

    async function commitIfNeeded(force = false) {
      if (opCount >= 450 || force) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const deudoresCol = db.collection("clientes").doc(clienteUID).collection("deudores");

    for (let i = 0; i < dataRows.length; i++) {
      const row = Array.isArray(dataRows[i]) ? dataRows[i] : [];
      const excelRowNumber = i + 3;

      try {
        const tipRaw = row[h.tipificacion];
        const ubicacion = String(row[h.ubicacion] || "").trim();
        const nombre = String(row[h.nombre] || "").trim();

        const telefonosArr = splitCsvToArray(row[h.telefonos]);
        const correosArr = splitCsvToArray(row[h.correos]);

        const deuda = parseNumber(row[h.deuda]);
        const honorariosDeuda = parseNumber(row[h.honorarios]);
        const porcentajeHonorarios = parseNumber(row[h.porcentaje]);

        if (!ubicacion) throw new Error("FALTA_UBICACION");
        if (!nombre) throw new Error("FALTA_NOMBRE");

        const tipificacion = normalizeTipificacion(tipRaw);
        if (!tipificacion) {
          tipificacionesInvalidas.push({
            fila: excelRowNumber,
            nit,
            mes,
            tipificacionExcel: String(tipRaw || "").trim(),
            ubicacion,
            nombre,
          });
          throw new Error("TIPIFICACION_INVALIDA");
        }

        // ✅ ID automático (NO depende de ubicación)
        const deudorRef = deudoresCol.doc(); // auto-id
        const deudorId = deudorRef.id;

        const deudorData = {
          activo: true,
          clienteUID,
          tipificacion,
          ubicacion,
          nombre,
          fechaCreacion: now,
          fechaActualizacion: now,
          ...(telefonosArr.length ? { telefonos: telefonosArr } : {}),
          ...(correosArr.length ? { correos: correosArr } : {}),
        };

        batch.set(deudorRef, deudorData, { merge: true });
        opCount += 1;

        const estadoRef = deudorRef.collection("estadosMensuales").doc(mes);
        const estadoData = {
          clienteUID,
          mes,
          deuda,
          recaudo: 0,
          porcentajeHonorarios,
          honorariosDeuda,
          honorariosRecaudo: 0,
        };

        batch.set(estadoRef, estadoData, { merge: true });
        opCount += 1;

        filasOK.push({
          fila: excelRowNumber,
          deudorId,
          ubicacion,
          nombre,
          tipificacion,
          deuda,
          honorariosDeuda,
          porcentajeHonorarios,
          telefonos: telefonosArr.join(", "),
          correos: correosArr.join(", "),
          status: "OK",
        });

        await commitIfNeeded(false);
      } catch (e) {
        filasError.push({
          fila: excelRowNumber,
          nit,
          mes,
          ubicacion: String(row[h.ubicacion] || "").trim(),
          nombre: String(row[h.nombre] || "").trim(),
          tipificacionExcel: String(row[h.tipificacion] || "").trim(),
          error: e?.message || String(e),
        });
      }
    }

    await commitIfNeeded(true);

    resumen.push({
      nit,
      mes,
      clienteUID,
      totalFilas: dataRows.length,
      ok: filasOK.length,
      error: filasError.length,
      tipificacionesInvalidas: tipificacionesInvalidas.length,
      timestamp: new Date().toISOString(),
    });

    console.log("✅ Migración completada.");
  } catch (e) {
    console.error("❌ Error general:", e?.message || e);
    resumen.push({
      status: "ERROR_GENERAL",
      error: e?.message || String(e),
      timestamp: new Date().toISOString(),
    });
  }

  // Reporte
  try {
    const outWb = loadOrCreateWorkbook(OUT_FILE);
    appendRowsToSheet(outWb, "Resumen", resumen);
    appendRowsToSheet(outWb, "Filas_OK", filasOK);
    appendRowsToSheet(outWb, "Filas_ERROR", filasError);
    appendRowsToSheet(outWb, "Tipificaciones_Invalidas", tipificacionesInvalidas);
    xlsx.writeFile(outWb, OUT_FILE);
    console.log(`📄 Reporte generado/actualizado: ${OUT_FILE}`);
  } catch (e) {
    console.warn("⚠️ No se pudo generar reporte:", e?.message || e);
  }

  console.log("🚀 Fin.");
})();
