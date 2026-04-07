/* eslint-disable no-console */
const admin = require('firebase-admin');

// ---- Firebase Admin ----
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ---- Configuración ----
const NUEVO_DEPENDIENTE_ABOGADO_ID = 'thUevPMJr1ef01lIJ0M14S9DdA53';
const BATCH_SIZE = 500; // Firestore permite máx 500 operaciones por batch

(async function main() {
  console.log('🚀 Iniciando actualización de dependienteAbogadoId en colección clientes...');
  console.log(`📌 Nuevo ID: ${NUEVO_DEPENDIENTE_ABOGADO_ID}`);

  let totalActualizados = 0;
  let lastDoc = null;

  try {
    // Recorre la colección en páginas de BATCH_SIZE
    while (true) {
      let query = db.collection('clientes').limit(BATCH_SIZE);
      if (lastDoc) query = query.startAfter(lastDoc);

      const snapshot = await query.get();
      if (snapshot.empty) break;

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { dependienteAbogadoId: NUEVO_DEPENDIENTE_ABOGADO_ID });
      });

      await batch.commit();

      totalActualizados += snapshot.docs.length;
      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      console.log(`✅ Lote procesado: ${snapshot.docs.length} documentos. Total acumulado: ${totalActualizados}`);

      // Si trajo menos que BATCH_SIZE ya no hay más páginas
      if (snapshot.docs.length < BATCH_SIZE) break;
    }

    console.log(`\n🎉 Migración completada. Total de clientes actualizados: ${totalActualizados}`);
  } catch (e) {
    console.error('❌ Error durante la migración:', e.message || e);
  }
})().catch((e) => {
  console.error('❌ Error no controlado:', e);
});

// Para correr el script:
// node .\actualizar-dependiente-abogado.js
