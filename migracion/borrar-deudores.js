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
'830015808',
'830074930',
'830042740',
'900291664',
'900367986',
'900153423',
'900060600',
'900123118',
'900754972',
'901359839',
'900041729',
'900194299',
'900051936',
'901507077',
'900422149',
'900182882',
'900026123',
'900539381',
'901001861',
'830113468',
'800237079',
'830056841',
'900291664',
'830015808',
'900153423',
'900539381',
'901359839',
'900026123',
'901507077',
'830056841',
'900654612',
'830074930',
'900123118',
'900041729',
'900194299',
'900051936',
'900422149',
'800237079',
'830042740',
'900367986',
'900182882',
'830113468',
'800245235',
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
 * Resuelve un identificador (UID o NIT) a un UID de cliente.
 *
 * Lógica:
 * 1) Intenta como UID directo en clientes/{id}.
 * 2) Si no existe, lo interpreta como NIT y busca en usuarios
 *    where numeroDocumento == valor (limit 1) y devuelve user.id.
 *
 * Devuelve:
 *  - string  → UID del cliente
 *  - null    → si no se encontró nada
 */
async function resolveClientUid(idOrNitRaw) {
  const idOrNit = String(idOrNitRaw || '').trim();
  if (!idOrNit) {
    console.log('⛔️ Identificador vacío, se omite.');
    return null;
  }

  // 1) Probar como UID directo de clientes
  const clientDoc = await db.collection('clientes').doc(idOrNit).get();
  if (clientDoc.exists) {
    console.log(`✔ "${idOrNit}" reconocido como UID de cliente.`);
    return idOrNit;
  }

  // 2) Probar como NIT en usuarios.numeroDocumento
  const usuariosRef = db.collection('usuarios');
  const qSnap = await usuariosRef
    .where('numeroDocumento', '==', idOrNit)
    .limit(1)
    .get();

  if (!qSnap.empty) {
    const userDoc = qSnap.docs[0];
    const uid = userDoc.id;
    console.log(`✔ "${idOrNit}" reconocido como NIT, resuelto a UID "${uid}".`);
    return uid;
  }

  console.log(`⛔️ No se encontró cliente para identificador/NIT "${idOrNit}".`);
  return null;
}

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
    console.log('⛔️ Debes especificar al menos un UID o NIT en CLIENT_UIDS.');
    process.exit(1);
  }

  const results = [];
  for (const rawId of CLIENT_UIDS) {
    try {
      const uid = await resolveClientUid(rawId);
      if (!uid) {
        const msg = 'No se pudo resolver a UID (ni como cliente ni como usuario.numeroDocumento).';
        results.push({ uid: null, original: rawId, subcollections: [], totalDeletedDocs: 0, error: msg });
        console.error(`❌ ${msg} -> "${rawId}"`);
      } else {
        const res = await deleteAllSubcollectionsOfClient(uid);
        results.push({ ...res, original: rawId });
      }
    } catch (e) {
      const msg = e?.message || String(e);
      results.push({ uid: null, original: rawId, subcollections: [], totalDeletedDocs: 0, error: msg });
      console.error(`❌ Error procesando identificador "${rawId}": ${msg}`);
    }
    if (SLEEP_MS_BETWEEN_CLIENTS > 0) await sleep(SLEEP_MS_BETWEEN_CLIENTS);
  }

  console.log('\n=== Resumen ===');
  for (const r of results) {
    const label = r.original ? `${r.original} (uid=${r.uid || 'N/A'})` : r.uid;

    if (r.error) {
      console.log(`• ${label}: ERROR -> ${r.error}`);
      continue;
    }
    if (!r.subcollections.length) {
      console.log(`• ${label}: sin subcolecciones o sin documentos.`);
      continue;
    }
    for (const s of r.subcollections) {
      if (s.error) {
        console.log(`  - ${s.colPath}: ERROR -> ${s.error}`);
      } else {
        console.log(`  - ${s.colPath}: ${s.deleted} doc(s) borrados`);
      }
    }
    console.log(`  Total docs borrados en ${label}: ${r.totalDeletedDocs}`);
  }

  console.log('\n🚀 Listo.');
  process.exit(0);
})();
