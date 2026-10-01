/* eslint-disable no-console */
// Agrega ciudades nuevas al array `ciudades` de la franquicia "Cundinamarca".
// No borra ni duplica las que ya existan (Bogotá queda intacta).
//
// Uso:
//   1) Previsualizar (no escribe):   node .\agregar-ciudades-cundinamarca.js
//   2) Ejecutar de verdad:           cambia DRY_RUN a false y vuelve a correr.

const admin = require('firebase-admin');

// ---- Firebase Admin ----
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ⚠️ Cambia a false para escribir realmente en Firestore.
const DRY_RUN = false;

const NOMBRE_FRANQUICIA = 'Cundinamarca';
const CIUDADES_NUEVAS = ['Zipaquirá', 'Funza', 'Madrid', 'Soacha', 'Carmen de Apicalá'];

(async function main() {
  console.log(`🚀 Agregar ciudades a "${NOMBRE_FRANQUICIA}" ${DRY_RUN ? '(DRY RUN — no escribe)' : '(ESCRITURA REAL)'}\n`);

  const snap = await db.collection('franquicias').where('nombre', '==', NOMBRE_FRANQUICIA).limit(1).get();

  if (snap.empty) {
    throw new Error(`No existe una franquicia con nombre "${NOMBRE_FRANQUICIA}". Corre seed-franquicias.js primero.`);
  }

  const doc = snap.docs[0];
  const actuales = doc.data().ciudades ?? [];
  const aAgregar = CIUDADES_NUEVAS.filter((c) => !actuales.includes(c));

  console.log(`🏢 Franquicia "${NOMBRE_FRANQUICIA}" (id: ${doc.id})`);
  console.log(`   Ciudades actuales: ${actuales.join(', ') || '(ninguna)'}`);

  if (aAgregar.length === 0) {
    console.log('\n✅ No hay ciudades nuevas que agregar, todas ya estaban.');
    return;
  }

  const resultado = [...actuales, ...aAgregar];
  console.log(`   Ciudades a agregar: ${aAgregar.join(', ')}`);
  console.log(`   Resultado final   : ${resultado.join(', ')}`);

  if (!DRY_RUN) {
    await doc.ref.update({ ciudades: resultado });
  }

  console.log(`\n🎉 ${DRY_RUN ? 'Previsualización' : 'Actualización'} completada.`);
})().catch((e) => {
  console.error('❌ Error:', e.message || e);
});
