/* eslint-disable no-console */
// Limpia las copias obsoletas del correo del cliente.
//
// Contexto: el correo de un cliente es el de acceso del usuario
// (`usuarios/{uid}.email`) y el id del doc de cliente ES ese uid. Guardar una
// copia en el doc de negocio dejaba el correo viejo cuando se usaba
// "Cambiar correo" en Usuarios. Este script borra esas copias:
//   - clientesParticulares/{uid}.correos   (array, rol clienteCaso)
//   - clientes/{uid}.correoContacto        (string, rol cliente)
//
// Antes de borrar avisa si la copia NO coincide con el correo de Auth/usuarios,
// para que quede rastro de qué valor se estaba mostrando mal.
//
// Uso:
//   node limpiar-correos-duplicados.js          (DRY_RUN por defecto)
//   DRY_RUN=false node limpiar-correos-duplicados.js

const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const DRY_RUN = process.env.DRY_RUN !== 'false';
const BATCH_SIZE = 499;

const norm = (v) => String(v ?? '').trim().toLowerCase();

async function emailDeUsuario(uid) {
  const snap = await db.doc(`usuarios/${uid}`).get();
  return norm(snap.exists ? snap.data().email : '');
}

async function limpiar({ coleccion, campo, valorActual }) {
  const snap = await db.collection(coleccion).get();
  let pendientes = [];
  let desincronizados = 0;

  for (const d of snap.docs) {
    const data = d.data();
    if (!(campo in data)) continue;

    const copia = valorActual(data);
    const real = await emailDeUsuario(d.id);

    if (copia && real && copia !== real) {
      desincronizados++;
      console.log(`  ⚠️  ${coleccion}/${d.id}: mostraba "${copia}" pero el acceso es "${real}"`);
    } else if (copia && !real) {
      console.log(`  ⚠️  ${coleccion}/${d.id}: tenía "${copia}" y no existe usuarios/${d.id}`);
    }

    pendientes.push(d.ref);
  }

  console.log(`\n${coleccion}.${campo}: ${pendientes.length} docs con el campo, ${desincronizados} desincronizados.`);

  if (DRY_RUN) {
    console.log('   (DRY_RUN: no se borró nada)');
    return;
  }

  for (let i = 0; i < pendientes.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const ref of pendientes.slice(i, i + BATCH_SIZE)) {
      batch.update(ref, { [campo]: admin.firestore.FieldValue.delete() });
    }
    await batch.commit();
    console.log(`   borrados ${Math.min(i + BATCH_SIZE, pendientes.length)}/${pendientes.length}`);
  }
}

(async function main() {
  console.log(DRY_RUN ? '🔎 DRY_RUN — nada se escribe\n' : '✍️  Escribiendo en Firestore\n');

  await limpiar({
    coleccion: 'clientesParticulares',
    campo: 'correos',
    valorActual: (data) => norm(Array.isArray(data.correos) ? data.correos[0] : ''),
  });

  await limpiar({
    coleccion: 'clientes',
    campo: 'correoContacto',
    valorActual: (data) => norm(data.correoContacto),
  });

  console.log('\n✅ Listo.');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
