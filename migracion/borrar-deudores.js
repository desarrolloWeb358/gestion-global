/* eslint-disable no-console */
/**
 * Borrado de TODAS las subcolecciones de clientes seleccionados
 * Ejecutar:
 *   node borrar-subcolecciones-clientes.js
 */

const admin = require('firebase-admin');
const path = require('path');

// ===================
// CONFIGURACIÓN
// ===================
const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json';

// UIDs de clientes a procesar
const CLIENT_UIDS = [
'dfoOnMyutjX0X4oGNZkTLpIYJ4D2',
];

// Pausa entre clientes (ms)
const SLEEP_MS_BETWEEN_CLIENTS = 50;
// Pausa ligera entre recursiveDelete intensivos (ms)
const SLEEP_MS_BETWEEN_DOCS = 5;

// ===================
// INICIALIZACIÓN
// ===================
admin.initializeApp({
  credential: admin.credential.cert(require(path.resolve(SERVICE_ACCOUNT_PATH))),
});

const db = admin.firestore();

// Utilidad simple para pausar
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Borra recursivamente TODOS los documentos de una colección dada (nivel 1).
 * - Para cada doc: recursiveDelete(docRef) → borra doc + sub-subcolecciones
 */
async function deleteAllDocsInCollection(colRef) {
  const snap = await colRef.get();
  if (snap.empty) return 0;

  let count = 0;
  for (const doc of snap.docs) {
    await admin.firestore().recursiveDelete(doc.ref);
    count += 1;
    if (SLEEP_MS_BETWEEN_DOCS > 0) await sleep(SLEEP_MS_BETWEEN_DOCS);
  }
  return count;
}

/**
 * Lista y borra TODAS las subcolecciones que cuelgan de clientes/{clientUid}
 * Conserva el documento del cliente (no borra campos del doc).
 */
async function deleteAllSubcollectionsOfClient(clientUid) {
  console.log(`\n--- Cliente: ${clientUid} ---`);
  const clientRef = db.collection('clientes').doc(clientUid);

  // Verifica que el doc exista (opcional, pero útil)
  const exists = (await clientRef.get()).exists;
  if (!exists) {
    console.log(`⛔️ clientes/${clientUid} no existe. Se omite.`);
    return { uid: clientUid, subcollections: [], totalDeletedDocs: 0, error: 'No existe' };
  }

  // Descubre todas las subcolecciones bajo el doc cliente
  const subcollections = await clientRef.listCollections();
  if (!subcollections.length) {
    console.log(`ℹ️ clientes/${clientUid} no tiene subcolecciones.`);
    return { uid: clientUid, subcollections: [], totalDeletedDocs: 0, error: '' };
  }

  let total = 0;
  const details = [];

  for (const colRef of subcollections) {
    const colPath = colRef.path; // p.ej: clientes/<uid>/deudores
    try {
      const deleted = await deleteAllDocsInCollection(colRef);
      total += deleted;
      console.log(`✅ ${colPath}: borrados ${deleted} documento(s) (incluye sub-subcolecciones).`);
      details.push({ colPath, deleted, error: '' });
    } catch (e) {
      const msg = e?.message || String(e);
      console.error(`❌ Error en ${colPath}: ${msg}`);
      details.push({ colPath, deleted: 0, error: msg });
    }
  }

  return { uid: clientUid, subcollections: details, totalDeletedDocs: total, error: '' };
}

// ===================
// LÓGICA PRINCIPAL
// ===================
(async function main() {
  console.log('=== Borrado de TODAS las subcolecciones en documentos de "clientes" ===');

  if (!Array.isArray(CLIENT_UIDS) || CLIENT_UIDS.length === 0) {
    console.log('⛔️ Debes especificar al menos un UID en CLIENT_UIDS.');
    process.exit(1);
  }

  const results = [];
  for (const uid of CLIENT_UIDS) {
    try {
      const res = await deleteAllSubcollectionsOfClient(uid);
      results.push(res);
    } catch (e) {
      const msg = e?.message || String(e);
      results.push({ uid, subcollections: [], totalDeletedDocs: 0, error: msg });
      console.error(`❌ Error procesando cliente ${uid}: ${msg}`);
    }
    if (SLEEP_MS_BETWEEN_CLIENTS > 0) await sleep(SLEEP_MS_BETWEEN_CLIENTS);
  }

  console.log('\n=== Resumen ===');
  for (const r of results) {
    if (r.error) {
      console.log(`• ${r.uid}: ERROR -> ${r.error}`);
      continue;
    }
    if (!r.subcollections.length) {
      console.log(`• ${r.uid}: sin subcolecciones o sin documentos.`);
      continue;
    }
    for (const s of r.subcollections) {
      if (s.error) {
        console.log(`  - ${s.colPath}: ERROR -> ${s.error}`);
      } else {
        console.log(`  - ${s.colPath}: ${s.deleted} doc(s) borrados`);
      }
    }
    console.log(`  Total docs borrados en ${r.uid}: ${r.totalDeletedDocs}`);
  }

  console.log('\n🚀 Listo.');
  process.exit(0);
})();
