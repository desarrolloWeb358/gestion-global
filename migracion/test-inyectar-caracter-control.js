/* eslint-disable no-console */
/**
 * SOLO PARA PRUEBAS. Inyecta un carácter de control U+0002 (STX) al inicio del
 * nombre de un deudor, para reproducir el bug que corrompía el .docx.
 *
 * Ver el deudor y su nombre actual:
 *   node test-inyectar-caracter-control.js --cliente=<clienteId> --deudor=<deudorId>
 *
 * Inyectar el carácter:
 *   node test-inyectar-caracter-control.js --cliente=<clienteId> --deudor=<deudorId> --inyectar
 *
 * Quitarlo (dejar el nombre limpio):
 *   node test-inyectar-caracter-control.js --cliente=<clienteId> --deudor=<deudorId> --limpiar
 */

const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json';

const STX = String.fromCharCode(2); // U+0002 (STX), el mismo que traía el dato original
const CONTROL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;

function arg(nombre) {
  const a = process.argv.find((x) => x.startsWith(`--${nombre}=`));
  return a ? a.split('=')[1] : null;
}

function describir(v) {
  return String(v).replace(CONTROL_RE, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`);
}

const CLIENTE = arg('cliente');
const DEUDOR = arg('deudor');
const INYECTAR = process.argv.includes('--inyectar');
const LIMPIAR = process.argv.includes('--limpiar');

if (!CLIENTE || !DEUDOR) {
  console.error('Faltan --cliente=<id> y --deudor=<id>');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)) });
const db = admin.firestore();

(async () => {
  const ref = db.doc(`clientes/${CLIENTE}/deudores/${DEUDOR}`);
  const snap = await ref.get();

  if (!snap.exists) {
    console.error('El deudor no existe');
    process.exit(1);
  }

  const actual = String(snap.data().nombre ?? '');
  console.log(`Nombre actual: "${describir(actual)}"`);

  const limpio = actual.replace(CONTROL_RE, '').trim();

  if (INYECTAR) {
    const nuevo = STX + limpio;
    await ref.update({ nombre: nuevo });
    console.log(`Nombre nuevo:  "${describir(nuevo)}"   <- carácter inyectado`);
  } else if (LIMPIAR) {
    await ref.update({ nombre: limpio });
    console.log(`Nombre nuevo:  "${limpio}"   <- limpio`);
  } else {
    console.log('\nDry-run: no se modificó nada. Usa --inyectar o --limpiar.');
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
