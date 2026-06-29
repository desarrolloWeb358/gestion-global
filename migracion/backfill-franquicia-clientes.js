/* eslint-disable no-console */
// Backfill de franquiciaId + ciudad en CLIENTES existentes.
// Pega abajo el id de la franquicia (el que imprime seed-franquicias.js) y la ciudad.
// Idempotente: solo escribe los campos que falten; no pisa valores ya puestos.
//
// Uso:
//   1) Corre seed-franquicias.js (real) y copia el id de la franquicia que toca.
//   2) Pega ese id en FRANQUICIA_ID y ajusta CIUDAD.
//   3) Previsualiza (DRY_RUN=true), revisa, luego DRY_RUN=false y corre de verdad.

const admin = require('firebase-admin');

// ---- Firebase Admin ----
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ⚠️ Cambia a false para escribir realmente en Firestore.
const DRY_RUN = false;

// 👇 Pega aquí el id de la franquicia (de seed-franquicias.js) y su ciudad.
const FRANQUICIA_ID = 'LQZ0v6BorErqeO284X86';
const CIUDAD = 'Bogotá';

const BATCH_SIZE = 499; // Firestore: máx 500 operaciones por batch

(async function main() {
  if (!FRANQUICIA_ID) {
    throw new Error('Falta FRANQUICIA_ID. Corre seed-franquicias.js, copia el id y pégalo arriba.');
  }

  console.log(`🚀 Backfill franquicia/ciudad en CLIENTES ${DRY_RUN ? '(DRY RUN — no escribe)' : '(ESCRITURA REAL)'}`);
  console.log(`🏢 franquiciaId: "${FRANQUICIA_ID}" · ciudad: "${CIUDAD}"\n`);

  const snap = await db.collection('clientes').get();
  console.log(`📋 Clientes encontrados: ${snap.size}\n`);

  let batch = db.batch();
  let ops = 0;
  let actualizados = 0;
  let yaCompletos = 0;

  async function flush() {
    if (ops === 0) return;
    if (!DRY_RUN) await batch.commit();
    console.log(`  💾 Lote de ${ops} ${DRY_RUN ? '(simulado)' : 'confirmado'}`);
    batch = db.batch();
    ops = 0;
  }

  for (const doc of snap.docs) {
    const data = doc.data();
    const patch = {};

    if (data.franquiciaId == null) patch.franquiciaId = FRANQUICIA_ID;
    if (data.ciudad == null) patch.ciudad = CIUDAD;

    if (Object.keys(patch).length === 0) {
      yaCompletos++;
      continue;
    }

    console.log(`  ✅ ${data.nombre || doc.id} ← ${JSON.stringify(patch)}`);
    if (!DRY_RUN) batch.update(doc.ref, patch);
    ops++;
    actualizados++;

    if (ops >= BATCH_SIZE) await flush();
  }

  await flush();

  console.log('\n=== Resultado ===');
  console.log(`  Actualizados        : ${actualizados}`);
  console.log(`  Ya tenían los campos: ${yaCompletos}`);
  console.log(`\n🎉 ${DRY_RUN ? 'Previsualización' : 'Backfill'} completado.`);
})().catch((e) => {
  console.error('❌ Error:', e.message || e);
});
