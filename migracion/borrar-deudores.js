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
'wv9vBoFG8JXNecNtqVDV1N6CiWT2',
'NAUfq7sQaBSljwqNaeh9pN02BTo1',
'b0vLAHFlhePsR4LjT3uzah7ZCPg1',
'EaGtfBj5bcP83P2QEBYqks1VjD43',
'7oLjXwP95aY1Tk9tG6AIloT4SAJ3',
'UYuR85kvmnetxSXBXQUYTxoXXv12',
'xiptkHQPwxVpwKMI59k7bn1GI6H2',
'WJg6TNFWTZguD6ccG3MhJgjYjTB2',
'scHSOnSSsDOAYzY8lzXA6KfkeSP2',
'v8cqen9p5QaPHki9BCYnlclJMEC2',
'0BZRb2c80xW8LBsLW97kIomfwwI3',
'Zwgdm8bszMfEDi2kw5VTLh6ssLJ2',
'xI9LjxtNXSZfjvPdVhVzPhPkmAj1',
'syAWsKTY8LXDBIrB9eDwfVOfcyB3',
'GOoxo01QRXgyQLGUAuUP2p66l7j2',
'I4sutyaAoxc0bZkdO4eWbAA9qaL2',
'HTRM4ciWupPZaFBoDperUN4AqWv2',
'jklEbQCESvdMjSTempcGkrOLaI12',
'KxzSg4RTQ0fZ0Ew4JWZLK0M1fUH2',
'ppnhXpKDAfUyAV9YDyvtPYCjxV22',
'6UqpWUIAhQY6NtKbtj4EzxYdbYA3',
'LFGOJALd4GRnQhwRpGoGpfPw9TX2',
'795I5KU9KOWKLe8l7SuxyYPt2Wn1',
'vry83QouD6O3GmvHxkfurK6gY9n1',
'sdrNTLKtPkQms6Vlc7I9G4H0GBI2',
'cfLp1ULLA8dhT4qCgjVr9qtwyUD2',
'nHoybpvnRxMooEujaIK4mdjpVaB3',
'wbPWdpDfnUTRQnM61YeAb3bK5yL2',
'fcwaPPHo4Zan8r65UXgUwSVXm0z2',
'1xW2KGBvdpPNKpjJ4ZJbSlzvWqr2',
'o9QP3ZiIFBQ4gotDg3iuriW5zL42',
'FDfPVAEOL7M314C59LnMxnMLJaM2',
'D0zZFnGDiqYFT0Rz2Vb52CPkcNx2',
'AxeHXJdshcUtDukPJf4dwJHxJPb2',
'AdWBakOli9PkfLPeA69AsVL2R5f1',
'61h4Ry0PyEVHMmVqcUYOT4fZs1n2',
'2h16rJBprgavM2Xw5IghxwRDxAh1',
'kzqDN3634BQsHv1XQT0KjRm4oDU2',
'mRfMho6Gw3VbrTqAUSgxHPrY8Aa2',
'QkS110YsTCdYdvuuwkTZaxM6fh42',
'z6JY2g8GrvczozdtEncEAGCSPm12',
'dfoOnMyutjX0X4oGNZkTLpIYJ4D2',
'OrNcw7QOp6ePPCwhR70ex4y6HuI3',
'hGDYklT2OqXvkym2hF1VChKe78M2',
'tcDe6s2vgCMf8dx5dkjY6tB4UO22',
'g05YI1pijkTJTXX8Bf0hChmJOmj1',
'KptL6VNIWLXHPkc1nacYrrHQVSw1',
'DSSKAr2yqbhyTQ2IWl8XiiGUzIp1',
'1SP8DaWQ7Ve0eLEWNnxD8EbXTeI3',
'H9e5ZFnhKVfVF4mXU0KOBTnaZxN2',
'tOL2wVMdxqMmcDtVp2xcz480SWr2',
'oPBo0zr5gLQAU2Afz4mSFSEkMnI2',
'iTyeD6Fhfgf0Va70KObPNoHnig53',
'QiTUDjBTmvWmzASR6HGVt3INEfv1',
'VCa0Fg9UjUgvAMaMxpOcYRhaZ0k2',
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
