/* eslint-disable no-console */
// Crea las franquicias base con IDs AUTOGENERADOS por Firestore.
// Idempotente: si ya existe una franquicia con el mismo nombre, no la duplica.
//
// Uso:
//   1) Previsualizar (no escribe):   node .\seed-franquicias.js
//   2) Ejecutar de verdad:           cambia DRY_RUN a false y vuelve a correr.

const admin = require('firebase-admin');

// ---- Firebase Admin ----
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ⚠️ Cambia a false para escribir realmente en Firestore.
const DRY_RUN = false;

const FRANQUICIAS = [
  { nombre: 'Cundinamarca', ciudades: ['Bogotá'] },
  { nombre: 'Eje Cafetero', ciudades: ['Pereira', 'Armenia', 'Manizales'] },
];

(async function main() {
  console.log(`🚀 Seed de franquicias ${DRY_RUN ? '(DRY RUN — no escribe)' : '(ESCRITURA REAL)'}\n`);

  for (const f of FRANQUICIAS) {
    // Idempotencia: como el id es autogenerado, evitamos duplicados buscando por nombre.
    const existing = await db.collection('franquicias').where('nombre', '==', f.nombre).limit(1).get();

    if (!existing.empty) {
      console.log(`  ⏭️  "${f.nombre}" ya existe (id: ${existing.docs[0].id}) → no se toca`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  ➕ Crear "${f.nombre}" [${f.ciudades.join(', ')}] → id: (autogenerado)`);
    } else {
      const ref = await db.collection('franquicias').add({
        nombre: f.nombre,
        ciudades: f.ciudades,
        activo: true,
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`  ➕ Creada "${f.nombre}" → id: ${ref.id}`);
    }
  }

  console.log(`\n🎉 ${DRY_RUN ? 'Previsualización' : 'Seed'} completado.`);
})().catch((e) => {
  console.error('❌ Error:', e.message || e);
});
