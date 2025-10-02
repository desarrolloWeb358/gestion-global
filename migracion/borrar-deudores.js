/* eslint-disable no-console */
/**
 * Borrado focalizado de "deudores" por cliente:
 * - Recibe un arreglo de UIDs de clientes en el código (CLIENT_UIDS).
 * - Para cada uid:
 *    - Intenta borrar recursivamente TODOS los docs en clientes/{uid}/deudores
 *      (cada doc + todas sus subcolecciones).
 * - NO toca Auth, NO borra usuarios/{uid}, NO borra clientes/{uid}.
 *
 * Requisitos:
 *   - Coloca serviceAccountKey.json junto a este archivo.
 *
 * Ejecutar:
 *   node borrar-deudores-por-clientes.js
 */

const admin = require('firebase-admin');
const path = require('path');

// ===================
// CONFIGURACIÓN
// ===================
const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json';

// UIDs de clientes a procesar (agrega uno o varios)
const CLIENT_UIDS = [
   '09aEATRahCSVcdh3oFTxaDud8w13',
  // 'uidCliente2',
];

// Nombre principal de la subcolección y fallback opcional
const MAIN_SUBCOLLECTION = 'deudores';

// Límite de concurrencia para no saturar (borrado por cliente se hace secuencial)
const SLEEP_MS_BETWEEN_CLIENTS = 50;

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
 * Borra recursivamente TODOS los documentos de una subcolección:
 * - Lista docs de `clientes/{uid}/{sub}`
 * - Para cada doc, hace recursiveDelete(docRef) -> borra doc + sub-subcolecciones
 */
async function deleteEntireSubcollection(clientUid, subcollectionName) {
  const subRef = db.collection(`clientes/${clientUid}/${subcollectionName}`);
  const snap = await subRef.get();

  if (snap.empty) {
    return { existed: false, deletedDocs: 0 };
  }

  let count = 0;
  for (const doc of snap.docs) {
    const ref = doc.ref;
    await admin.firestore().recursiveDelete(ref);
    count += 1;
    // (Opcional) puedes pausar un poco entre docs si tu dataset es grande:
    // await sleep(10);
  }

  return { existed: true, deletedDocs: count };
}

/**
 * Intenta borrar primero MAIN_SUBCOLLECTION.
 */
async function deleteClientDebtors(clientUid) {
  console.log(`\n--- Cliente: ${clientUid} ---`);
  try {
    // 1) Intento principal
    const mainRes = await deleteEntireSubcollection(clientUid, MAIN_SUBCOLLECTION);
    if (mainRes.existed) {
      console.log(
        `✅ Borrados ${mainRes.deletedDocs} documento(s) en clientes/${clientUid}/${MAIN_SUBCOLLECTION} (con todas sus subcolecciones).`
      );
      return { uid: clientUid, subcollection: MAIN_SUBCOLLECTION, deleted: mainRes.deletedDocs, fallbackUsed: false, error: '' };
    }       
    
  } catch (e) {
    console.error(`❌ Error procesando cliente ${clientUid}:`, e?.message || e);
    return { uid: clientUid, subcollection: '', deleted: 0, fallbackUsed: false, error: e?.message || String(e) };
  }
}

// ===================
// LÓGICA PRINCIPAL
// ===================
(async function main() {
  console.log('=== Borrado de subcolección "deudores" por cliente ===');

  if (!Array.isArray(CLIENT_UIDS) || CLIENT_UIDS.length === 0) {
    console.log('⛔️ Debes especificar al menos un UID en CLIENT_UIDS.');
    process.exit(1);
  }

  const results = [];
  for (const uid of CLIENT_UIDS) {
    const res = await deleteClientDebtors(uid);
    results.push(res);
    await sleep(SLEEP_MS_BETWEEN_CLIENTS);
  }

  console.log('\n=== Resumen ===');
  for (const r of results) {
    if (r.error) {
      console.log(`• ${r.uid}: ERROR -> ${r.error}`);
    } else if (!r.subcollection) {
      console.log(`• ${r.uid}: sin subcolección encontrada`);
    } else {
      const label = r.fallbackUsed ? `${r.subcollection} (fallback)` : r.subcollection;
      console.log(`• ${r.uid}: borrados ${r.deleted} doc(s) en ${label}`);
    }
  }

  console.log('\n🚀 Listo.');
  process.exit(0);
})();
