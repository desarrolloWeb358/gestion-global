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
'900687420',
'900291664',
'830018673',
'900387627',
'900123743',
'901001861',
'900003261',
'900377532',
'900190116',
'900155802',
'900506434',
'900654612',
'830032420',
'900715424',
'830006055',
'900947384',
'830125131',
'830121765',
'800142993',
'830074497',
'900122253',
'800119310',
'830057747',
'900658412',
'900281120',
'830096405',
'900539381',
'900266721',
'900366498',
'860040335',
'900786792',
'830064945',
'901507077',
'901132823',
'901213216',
'800193176',
'830075332',
'800206093',
'830135812',
'832005276',
'800234376',
'860404520',
'830113468',
'800177027',
'830119707',
'800237079',
'900473941',
'860450841',
'900060600',
'900404487',
'900084381',
'830131333',
'900182882',
'901554013',
'830113211',
'830076458',
'900759684',
'901747169',
'900121375',
'900328260',
'900232631',
'900481528',
'901562955',
'900237253',
'860352766',
'800095818',
'830088870',
'900334680',
'900715763',
'900495255',
'830146081',
'900367986',
'800250273',
'830027772',
'900229811',
'900719591',
'900748799',
'900115005',
'830079494',
'809011754',
'830002180',
'800198168',
'900947320',
'900346849',
'830115545',
'901335235',
'900812356',
'900042174',
'901332807',
'901031409',
'901400806',
'830036121',
'800057394',
'900849952',
'830074930',
'800238184',
'830071086',
'900051936',
'860530921',
'900745947',
'900323880',
'900643491',
'901359839',
'900422149',
'830077961',
'830073688',
'900253555',
'900296386',
'900305611',
'900143246',
'830105124',
'830042740',
'830013285',
'800217483',
'830015808',
'900208664',
'901194167',
'900176157',
'900123118',
'830116263',
'900242902',
'900247733',
'830035457',
'900026123',
'900754972',
'830094327',
'900040178',
'900162919',
'900153423',
'900546980',
'800190771',
'901334383',
'800168829',
'900271099',
'800236456',
'900361188',
'900353436',
'901268833',
'900002446',
'830047278',
'900097482',
'830056841',
'900243855',
'830032560',
'830147668',
'900863645',
'900840280',
'900382589',
'900489785',
'900360842',
'860100007',
'830042712',
'800115495',
'900545280',
'901020816',
'900273325',
'900283218',
'901801045',
'830018187',
'900061167',
'900194299',
'830147484',
'901151343',
'860043705',
'901458746',
'830089370',
'830102273',
'900309487',
'900227246',
'900306295',
'900041729',
'830136067',
'900746489',
'901509798',
'900892217',
'800245235',
'900784867',
'830121549',
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
