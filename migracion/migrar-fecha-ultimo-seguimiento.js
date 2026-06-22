/* eslint-disable no-console */
const admin = require('firebase-admin');

// ---- Firebase Admin ----
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ---- Configuración ----
const BATCH_SIZE = 499; // Firestore permite máx 500 operaciones por batch

// ── MODO PRUEBA ──────────────────────────────────────────────────────────────
// Pon el ID de un cliente de prueba para verificar antes de correr en todos.
// Déjalo en null para procesar TODOS los clientes.
const CLIENTE_PRUEBA = null; // ej: 'abc123xyz' → solo ese cliente
// ────────────────────────────────────────────────────────────────────────────

/**
 * Lógica de campos:
 *   seguimiento + seguimientoJuridico  →  deudor.fechaUltimoSeguimiento
 *   seguimientoDemanda                 →  deudor.fechaUltimaRevision
 *
 * Por cada documento se usa fechaCreacion si existe (registros anteriores),
 * o fecha como fallback (registros nuevos que ya solo guardan fecha = ahora).
 */

/**
 * Devuelve el Timestamp más reciente de las subcollecciones indicadas.
 * Por cada doc: prefiere fechaCreacion (real), cae en fecha si no existe.
 */
async function getLatestTimestamp(clienteId, deudorId, subcols) {
  let latest = null;

  for (const col of subcols) {
    const snap = await db
      .collection(`clientes/${clienteId}/deudores/${deudorId}/${col}`)
      .get();

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      // fechaCreacion = timestamp real de creación (registros viejos)
      // fecha         = timestamp de creación (registros nuevos, ya son lo mismo)
      const ts = data.fechaCreacion ?? data.fecha;
      if (ts && typeof ts.toMillis === 'function') {
        if (!latest || ts.toMillis() > latest.toMillis()) {
          latest = ts;
        }
      }
    }
  }

  return latest; // null si no hay ningún documento
}

(async function main() {
  console.log('🚀 Iniciando migración de fechaUltimoSeguimiento y fechaUltimaRevision...\n');

  const clientesSnap = CLIENTE_PRUEBA
    ? await db.collection('clientes').where(admin.firestore.FieldPath.documentId(), '==', CLIENTE_PRUEBA).get()
    : await db.collection('clientes').get();
  console.log(`📋 Clientes encontrados: ${clientesSnap.size}\n`);

  let totalDeudores = 0;
  let errores = 0;

  let batch = db.batch();
  let opsEnBatch = 0;

  async function flushBatch() {
    if (opsEnBatch === 0) return;
    await batch.commit();
    console.log(`  💾 Lote de ${opsEnBatch} escrituras confirmadas`);
    batch = db.batch();
    opsEnBatch = 0;
  }

  try {
    for (const clienteDoc of clientesSnap.docs) {
      const clienteId = clienteDoc.id;
      const nombreCliente = clienteDoc.data().nombre || clienteId;

      const deudoresSnap = await db
        .collection(`clientes/${clienteId}/deudores`)
        .get();

      if (deudoresSnap.empty) continue;

      console.log(`\n[${nombreCliente}] — ${deudoresSnap.size} deudores`);

      for (const deudorDoc of deudoresSnap.docs) {
        const nombreDeudor = deudorDoc.data().nombre || deudorDoc.id;
        totalDeudores++;

        try {
          // ── Campo 1: seguimiento ejecutivos ──────────────────────────────
          const fechaUltimoSeguimiento = await getLatestTimestamp(
            clienteId,
            deudorDoc.id,
            ['seguimiento', 'seguimientoJuridico']
          );

          // ── Campo 2: seguimiento demanda ─────────────────────────────────
          const fechaUltimaRevision = await getLatestTimestamp(
            clienteId,
            deudorDoc.id,
            ['seguimientoDemanda']
          );

          // Actualizar ambos campos en una sola operación del batch
          batch.update(deudorDoc.ref, {
            fechaUltimoSeguimiento: fechaUltimoSeguimiento ?? null,
            fechaUltimaRevision: fechaUltimaRevision ?? null,
          });
          opsEnBatch++;

          const seg = fechaUltimoSeguimiento
            ? fechaUltimoSeguimiento.toDate().toLocaleDateString('es-CO')
            : 'null';
          const dem = fechaUltimaRevision
            ? fechaUltimaRevision.toDate().toLocaleDateString('es-CO')
            : 'null';

          console.log(`  ✅ ${nombreDeudor} | seg: ${seg} | dem: ${dem}`);

          if (opsEnBatch >= BATCH_SIZE) await flushBatch();

        } catch (err) {
          errores++;
          console.error(`  ❌ ${nombreDeudor} → ERROR:`, err.message || err);
        }
      }
    }

    await flushBatch(); // confirmar el último lote

    console.log('\n=== Resultado ===');
    console.log(`  Total deudores procesados : ${totalDeudores}`);
    if (errores > 0) console.log(`  Errores                   : ${errores}`);
    console.log('\n🎉 Migración completada.');
  } catch (e) {
    console.error('❌ Error durante la migración:', e.message || e);
  }
})().catch((e) => {
  console.error('❌ Error no controlado:', e);
});

// Para correr el script:
// node .\migrar-fecha-ultimo-seguimiento.js
