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

// --- Config ---
const excelPath = "./ProcesosJudiciales.xlsx";                // <-- cambia si es necesario
const OUTPUT_MIGRADOS = "./ProcesosJudiciales_migrados.xlsx";
const OUTPUT_NO_MIGRADOS = "./ProcesosJudiciales_no_migrados.xlsx";
const DRY_RUN = false; // true = no escribe, solo simula

// Mapeo ejecutivo -> UID (case-insensitive)
const EJECUTIVOS_UID = {
  // claves en minúscula
  nicoll: "FWn2ELTvlSSDxnrvoAkBGewzBr43",
  laura:  "TkBWDCsUzjNCwdu5q8cXciSQqmQ2",
  // agrega más si aparecen en tu Excel...
};

// Inicializa Firebase Admin
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

/** Utils */
const toStr = (v) => (v === undefined || v === null) ? "" : String(v).trim();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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

async function main() {
  let migrados = 0;
  let noMigrados = 0;

  const wb = xlsx.readFile(excelPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  console.log(`📄 ${rows.length} filas leídas de ${excelPath}`);

  const okRows = [];      // para OUTPUT_MIGRADOS
  const badRows = [];     // para OUTPUT_NO_MIGRADOS

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];

    // Lectura tolerante de encabezados
    const ejecutivoRaw   = toStr(raw.ejecutivo || raw.Ejecutivo || raw.EJECUTIVO);
    const nit            = toStr(raw.nit || raw.Nit || raw.NIT || raw.CLIENTE || raw.cliente);
    const ubicacion      = toStr(raw.ubicacion || raw.UBICACIÓN || raw.UBICACION);

    const demandados     = toStr(raw.demandados || raw.Demandados || raw.DEMANDADOS);
    const juzgado        = toStr(raw.juzgado || raw.Juzgado || raw.JUZGADO);
    const numeroRadicado = toStr(
      raw.numero_radicado ||
      raw["numero radicado"] ||
      raw["NUMERO RADICADO"] ||
      raw.Numero_Radicado ||
      raw.NumeroRadicado ||
      raw.NUMERO_RADICADO
    );
    const localidad      = toStr(raw.localidad || raw.Localidad || raw.LOCALIDAD);
    const observaciones  = toStr(raw.observaciones || raw.Observaciones || raw.OBSERVACIONES);

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
      // Cualquier error inesperado también va a "no migrados"
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
  xlsx.writeFile(okWb, OUTPUT_MIGRADOS);

  // Escribir NO MIGRADOS
  const badSheet = xlsx.utils.json_to_sheet(badRows);
  const badWb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(badWb, badSheet, "NoMigrados");
  xlsx.writeFile(badWb, OUTPUT_NO_MIGRADOS);

  console.log("────────────────────────────────────────");
  console.log(`✅ Migrados:     ${migrados}`);
  console.log(`⚠️  No migrados:  ${noMigrados}`);
  console.log(`📁 OK:           ${OUTPUT_MIGRADOS}`);
  console.log(`📁 Errores:      ${OUTPUT_NO_MIGRADOS}`);
  console.log("🚀 Proceso finalizado.");
}

main().catch((e) => {
  console.error("Error fatal:", e);
  process.exit(1);
});
