/* eslint-disable no-console */
/**
 * Limpieza del modelo VIEJO de demandas (correr SOLO después de migrar y verificar).
 *
 * Borra, únicamente en los deudores YA migrados (`demandaMigradaId` presente y con
 * su demanda existente), exactamente los campos/colección que `migrar-demandas.js`
 * copió a la subcolección `demandas`:
 *
 *   Campos del deudor:  numeroRadicado, juzgado, localidad, demandados,
 *                       demandaSustituto, observacionesDemanda,
 *                       observacionesDemandaCliente, observacionesDemandaClienteFecha,
 *                       procesoJudicial
 *   Subcolección:       clientes/{cid}/deudores/{did}/seguimientoDemanda  (copiada a la demanda)
 *
 * NO toca:
 *   - fechaUltimaRevision  → se mantiene denormalizada en el deudor (dashboards por deudor)
 *   - demandaMigradaId     → se conserva como marca de que ya se migró
 *   - juzgadoId, numeroProceso, anoProceso → NO se usan en ninguna pantalla; se dejan intactos
 *
 * Seguridad:
 *   - Solo procesa deudores con `demandaMigradaId`.
 *   - Verifica que la demanda destino exista antes de borrar (si no, salta y avisa).
 *   - DRY-RUN por defecto; escribe solo con --commit.
 *
 * Uso:
 *   node .\limpiar-demandas-legacy.js                       → DRY-RUN (no borra nada)
 *   node .\limpiar-demandas-legacy.js --commit              → ejecuta la limpieza
 *   node .\limpiar-demandas-legacy.js --commit --cliente=<clienteId>   → un solo cliente
 */

const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ---- Flags ----
const ARGS = process.argv.slice(2);
const COMMIT = ARGS.includes("--commit");
const CLIENTE_FILTRO =
  (ARGS.find((a) => a.startsWith("--cliente=")) || "").split("=")[1] || null;

// Campos legacy que la migración copió a la demanda → se pueden borrar del deudor.
const CAMPOS_LEGACY = [
  "numeroRadicado",
  "juzgado",
  "localidad",
  "demandados",
  "demandaSustituto",
  "observacionesDemanda",
  "observacionesDemandaCliente",
  "observacionesDemandaClienteFecha",
  "procesoJudicial",
];

async function limpiarDeudor(clienteId, deudorDoc, stats) {
  const data = deudorDoc.data();
  const deudorId = deudorDoc.id;

  // Solo deudores migrados
  const demandaId = data.demandaMigradaId;
  if (!demandaId) {
    stats.noMigrados++;
    return;
  }

  // Verificar que la demanda destino exista (no borrar si algo quedó a medias)
  const demandaRef = db.doc(
    `clientes/${clienteId}/deudores/${deudorId}/demandas/${demandaId}`
  );
  const demandaSnap = await demandaRef.get();
  if (!demandaSnap.exists) {
    stats.sinDemandaDestino++;
    console.warn(
      `  ⚠️  ${data.nombre || deudorId}: demandaMigradaId=${demandaId} no existe → se salta`
    );
    return;
  }

  // ¿Qué campos legacy están presentes?
  const camposAPurgar = CAMPOS_LEGACY.filter((c) => data[c] !== undefined);

  // Subcolección legacy del deudor
  const legacySegSnap = await db
    .collection(`clientes/${clienteId}/deudores/${deudorId}/seguimientoDemanda`)
    .get();

  if (camposAPurgar.length === 0 && legacySegSnap.empty) {
    stats.yaLimpios++;
    return;
  }

  console.log(
    `  → ${data.nombre || deudorId}: campos=[${camposAPurgar.join(", ")}] | ` +
      `seguimientos legacy=${legacySegSnap.size}`
  );

  if (!COMMIT) {
    stats.limpiados++;
    stats.camposBorrados += camposAPurgar.length;
    stats.seguimientosBorrados += legacySegSnap.size;
    return;
  }

  // 1) Borrar campos legacy del deudor
  if (camposAPurgar.length > 0) {
    const patch = {};
    camposAPurgar.forEach((c) => (patch[c] = FieldValue.delete()));
    await deudorDoc.ref.update(patch);
    stats.camposBorrados += camposAPurgar.length;
  }

  // 2) Borrar la subcolección legacy seguimientoDemanda (en lotes)
  if (!legacySegSnap.empty) {
    let batch = db.batch();
    let ops = 0;
    for (const s of legacySegSnap.docs) {
      batch.delete(s.ref);
      ops++;
      if (ops >= 400) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();
    stats.seguimientosBorrados += legacySegSnap.size;
  }

  stats.limpiados++;
}

(async function main() {
  console.log(
    `🧹 Limpieza de demandas legacy — modo: ${COMMIT ? "COMMIT (borra)" : "DRY-RUN (solo lee)"}` +
      (CLIENTE_FILTRO ? ` — cliente único: ${CLIENTE_FILTRO}` : "")
  );

  const clientesSnap = CLIENTE_FILTRO
    ? await db
        .collection("clientes")
        .where(admin.firestore.FieldPath.documentId(), "==", CLIENTE_FILTRO)
        .get()
    : await db.collection("clientes").get();

  console.log(`📋 Clientes a revisar: ${clientesSnap.size}\n`);

  const stats = {
    limpiados: 0,
    yaLimpios: 0,
    noMigrados: 0,
    sinDemandaDestino: 0,
    camposBorrados: 0,
    seguimientosBorrados: 0,
    errores: 0,
  };

  for (const clienteDoc of clientesSnap.docs) {
    const clienteId = clienteDoc.id;
    const nombreCliente = clienteDoc.data().nombre || clienteId;

    const deudoresSnap = await db
      .collection(`clientes/${clienteId}/deudores`)
      .get();
    if (deudoresSnap.empty) continue;

    console.log(`\n[${nombreCliente}] — ${deudoresSnap.size} deudores`);

    for (const deudorDoc of deudoresSnap.docs) {
      try {
        await limpiarDeudor(clienteId, deudorDoc, stats);
      } catch (err) {
        stats.errores++;
        console.error(
          `  ❌ ${deudorDoc.data().nombre || deudorDoc.id} → ${err.message || err}`
        );
      }
    }
  }

  console.log("\n════════════════════════════════════════");
  console.log(`  Deudores ${COMMIT ? "limpiados" : "que se limpiarían"} : ${stats.limpiados}`);
  console.log(`  Campos legacy borrados          : ${stats.camposBorrados}`);
  console.log(`  Seguimientos legacy borrados    : ${stats.seguimientosBorrados}`);
  console.log(`  Ya estaban limpios              : ${stats.yaLimpios}`);
  console.log(`  Sin migrar (se saltan)          : ${stats.noMigrados}`);
  console.log(`  Migrados sin demanda destino    : ${stats.sinDemandaDestino}`);
  if (stats.errores > 0) console.log(`  Errores                         : ${stats.errores}`);
  console.log("════════════════════════════════════════");
  if (!COMMIT) {
    console.log("ℹ️  DRY-RUN: no se borró nada. Repite con --commit para ejecutar.");
  } else {
    console.log("🎉 Limpieza completada.");
  }
})().catch((e) => {
  console.error("❌ Error no controlado:", e);
  process.exit(1);
});
