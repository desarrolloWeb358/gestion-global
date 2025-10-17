/* eslint-disable no-console */
/**
 * Borrado focalizado de "deudores" por cliente
 * Ejecutar:
 *   node borrar-deudores.js
 */

const admin = require('firebase-admin');
const path = require('path');

// ===================
// CONFIGURACIÓN
// ===================
const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json';

// UIDs de clientes a procesar
const CLIENT_UIDS = [
  '3zTvYdP34DT0BJWIQnCMD1xRN3l1',
  'HeHR9dGI2APFSaAVmmR1y2BsPAn2',
  'bs19MoVq6lZjmLyNbswQDuABI3x2',
  'j2ptFkqVbVbGRe6SVhrEzzSNNck2',
  'jejrRcVQ1WOG1wXOxcNgPSLzpZX2',
  'noR18twdH1S5WSpBJTu4A2vQNgZ2',
];

// Nombre de la subcolección
const MAIN_SUBCOLLECTION = 'deudores';

// Pausa entre clientes
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
    // Si tu dataset es MUY grande, puedes pausar:
    // await sleep(10);
  }

  return { existed: true, deletedDocs: count };
}

/**
 * Intenta borrar MAIN_SUBCOLLECTION y SIEMPRE retorna un resultado.
 */
async function deleteClientDebtors(clientUid) {
  console.log(`\n--- Cliente: ${clientUid} ---`);
  try {
    const mainRes = await deleteEntireSubcollection(clientUid, MAIN_SUBCOLLECTION);

    if (mainRes.existed) {
      console.log(
        `✅ Borrados ${mainRes.deletedDocs} documento(s) en clientes/${clientUid}/${MAIN_SUBCOLLECTION} (con todas sus subcolecciones).`
      );
      return {
        uid: clientUid,
        subcollection: MAIN_SUBCOLLECTION,
        deleted: mainRes.deletedDocs,
        fallbackUsed: false,
        error: '',
      };
    } else {
      console.log(
        `ℹ️ No hay documentos en clientes/${clientUid}/${MAIN_SUBCOLLECTION}.`
      );
      return {
        uid: clientUid,
        subcollection: '',
        deleted: 0,
        fallbackUsed: false,
        error: '',
      };
    }
  } catch (e) {
    const msg = e?.message || String(e);
    console.error(`❌ Error procesando cliente ${clientUid}:`, msg);
    return {
      uid: clientUid,
      subcollection: '',
      deleted: 0,
      fallbackUsed: false,
      error: msg,
    };
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
    // Siempre debería venir un objeto por el fix; aún así, blindamos:
    results.push(res || {
      uid,
      subcollection: '',
      deleted: 0,
      fallbackUsed: false,
      error: 'Resultado indefinido',
    });
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
