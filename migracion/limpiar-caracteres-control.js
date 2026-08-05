/* eslint-disable no-console */
/**
 * Detecta (y opcionalmente limpia) caracteres de control en los campos de texto
 * de los deudores. Esos caracteres rompen el XML del .docx y hacen que Word
 * rechace el reporte completo con "Word detectó un error al abrir el archivo".
 *
 * Dry-run (solo reporta):   node limpiar-caracteres-control.js
 * Aplicar la limpieza:      node limpiar-caracteres-control.js --fix
 * Un solo cliente:          node limpiar-caracteres-control.js --cliente=<clienteId>
 */

const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json';

const APLICAR = process.argv.includes('--fix');
const CLIENTE_ARG = (process.argv.find((a) => a.startsWith('--cliente=')) || '').split('=')[1] || null;

// Campos de texto del deudor que terminan impresos en el reporte
const CAMPOS = ['nombre', 'ubicacion', 'observaciones', 'demandados', 'correo', 'telefono', 'documento'];

// XML 1.0 no admite caracteres de control salvo tab (09), LF (0A) y CR (0D)
const CONTROL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;

function limpiar(v) {
  return String(v).replace(CONTROL_RE, '').trim();
}

function describir(v) {
  return String(v).replace(CONTROL_RE, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`);
}

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
});
const db = admin.firestore();

(async () => {
  const clientesSnap = CLIENTE_ARG
    ? [await db.collection('clientes').doc(CLIENTE_ARG).get()]
    : (await db.collection('clientes').get()).docs;

  let revisados = 0;
  let sucios = 0;

  for (const cliente of clientesSnap) {
    if (!cliente.exists) {
      console.log(`Cliente ${CLIENTE_ARG} no existe`);
      continue;
    }

    const deudoresSnap = await db.collection(`clientes/${cliente.id}/deudores`).get();

    for (const deudor of deudoresSnap.docs) {
      revisados++;
      const data = deudor.data();
      const cambios = {};

      for (const campo of CAMPOS) {
        const v = data[campo];
        if (typeof v !== 'string') continue;
        CONTROL_RE.lastIndex = 0;
        if (!CONTROL_RE.test(v)) continue;
        cambios[campo] = limpiar(v);
        console.log(
          `${cliente.id}/${deudor.id}  ${campo}: "${describir(v)}"  ->  "${cambios[campo]}"`
        );
      }

      if (!Object.keys(cambios).length) continue;
      sucios++;

      if (APLICAR) {
        await deudor.ref.update(cambios);
      }
    }
  }

  console.log(`\nDeudores revisados: ${revisados}`);
  console.log(`Deudores con caracteres de control: ${sucios}`);
  console.log(APLICAR ? 'Cambios APLICADOS.' : 'Dry-run: no se modificó nada. Usa --fix para aplicar.');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
