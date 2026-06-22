/**
 * Reversa de migración de clientes:
 * - Selecciona usuarios con rol "cliente".
 * - Borra Auth (si existe).
 * - Borra usuarios/{uid}.
 * - Borra recursivamente clientes/{uid} (incluye subcolecciones).
 *
 * Configuración rápida:
 *   - Pon tu serviceAccountKey.json junto a este archivo.
 *   - Ajusta LIMIT y DRY_RUN según necesites.
 *
 * Ejecutar:
 *   node borrar-clientes.js
 */

const admin = require('firebase-admin');
const xlsx = require('xlsx');
const path = require('path');

// ===================
// CONFIGURACIÓN
// ===================
const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json';

// Máximo de clientes a procesar (null o 0 = todos)
const LIMIT = 5;

// Simulación (no borra nada en Auth ni Firestore si true)
const DRY_RUN = false;

// Si quieres filtrar además por campo "migrado === false" en usuarios
// (útil si solo deseas revertir los de la primera corrida)
const FILTRAR_MIGRADO_FALSE = false;

// Ruta del reporte
const OUTPUT_PATH = path.resolve('./Clientes_borrados.xlsx');

// ===================
// INICIALIZACIÓN
// ===================
admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
});

const auth = admin.auth();
const db = admin.firestore();

// Pequeña ayuda para esperar entre lotes si necesitas cadenciar
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// ===================
// LÓGICA PRINCIPAL
// ===================
(async function main() {
  console.log('=== Reversa de migración de clientes ===');
  console.log(`DRY_RUN: ${DRY_RUN ? 'ON (simulación)' : 'OFF (borrado real)'}`);
  if (LIMIT && LIMIT > 0) console.log(`LIMIT: se procesarán como máximo ${LIMIT} clientes`);

  // 1) Query de usuarios con rol 'cliente'
  let query = db.collection('usuarios').where('roles', 'array-contains', 'cliente');
  if (FILTRAR_MIGRADO_FALSE) {
    query = query.where('migrado', '==', false);
  }

  const snap = await query.get();
  if (snap.empty) {
    console.log('No se encontraron usuarios con rol cliente con los filtros especificados.');
    return;
  }

  const docs = snap.docs;
  console.log(`Encontrados ${docs.length} usuarios con rol cliente.`);

  const rows = [];
  let processed = 0;

  for (const doc of docs) {
    if (LIMIT && LIMIT > 0 && processed >= LIMIT) break;

    const uid = doc.id;
    const data = doc.data() || {};
    const email = data.email || '';
    const row = {
      uid,
      email,
      authDelete: '',
      usuariosDelete: '',
      clientesDelete: '',
      error: '',
    };

    console.log('\n----------------------------------------');
    console.log(`Procesando UID: ${uid}  Email: ${email}`);

    try {
      // 2) Eliminar usuario en Auth
      try {
        if (DRY_RUN) {
          console.log(`(DRY_RUN) auth.deleteUser(${uid})`);
          row.authDelete = 'SIMULADO';
        } else {
          await auth.deleteUser(uid);
          console.log(`✅ Eliminado en Auth: ${uid}`);
          row.authDelete = 'OK';
        }
      } catch (e) {
        // Si no existe, lo anotamos y seguimos
        if (e && (e.code === 'auth/user-not-found' || e.errorInfo?.code === 'auth/user-not-found')) {
          console.log(`ℹ️ Usuario no existe en Auth (${uid}). Continuo...`);
          row.authDelete = 'NO_EXISTE';
        } else {
          console.warn(`⚠️ Error eliminando en Auth (${uid}): ${e.message || e}`);
          row.authDelete = `ERROR: ${e.message || e}`;
        }
      }

      // 3) Eliminar documento usuarios/{uid}
      try {
        if (DRY_RUN) {
          console.log(`(DRY_RUN) db.collection('usuarios').doc(${uid}).delete()`);
          row.usuariosDelete = 'SIMULADO';
        } else {
          await db.collection('usuarios').doc(uid).delete();
          console.log(`✅ Eliminado usuarios/${uid}`);
          row.usuariosDelete = 'OK';
        }
      } catch (e) {
        console.warn(`⚠️ Error eliminando usuarios/${uid}: ${e.message || e}`);
        row.usuariosDelete = `ERROR: ${e.message || e}`;
      }

      // 4) Eliminar recursivamente clientes/{uid} (incluye subcolecciones)
      try {
        const clienteRef = db.collection('clientes').doc(uid);
        if (DRY_RUN) {
          console.log(`(DRY_RUN) recursiveDelete(clientes/${uid})`);
          row.clientesDelete = 'SIMULADO';
        } else {
          // recursiveDelete borra el doc y TODAS sus subcolecciones
          await admin.firestore().recursiveDelete(clienteRef);
          console.log(`✅ Eliminado recursivamente clientes/${uid} (doc + subcolecciones)`);
          row.clientesDelete = 'OK';
        }
      } catch (e) {
        console.warn(`⚠️ Error en recursiveDelete clientes/${uid}: ${e.message || e}`);
        row.clientesDelete = `ERROR: ${e.message || e}`;
      }
    } catch (e) {
      console.error(`❌ Error general con UID ${uid}:`, e);
      row.error = e.message || String(e);
    }

    rows.push(row);
    processed += 1;

    // Opcional: pausa breve entre usuarios para evitar picos
    await sleep(50);
  }

  // 5) Reporte en Excel
  try {
    const sheet = xlsx.utils.json_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, sheet, 'Borrados');
    xlsx.writeFile(wb, OUTPUT_PATH);
    console.log(`\n📁 Reporte generado: ${OUTPUT_PATH}`);
  } catch (e) {
    console.warn(`⚠️ No se pudo escribir el Excel de reporte: ${e.message || e}`);
  }

  console.log('\n🚀 Proceso finalizado.');
})();
