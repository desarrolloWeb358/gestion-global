/*
 * Calcula `clientes/{id}.geo` (coordenadas del conjunto para el mapa) a los
 * clientes que ya existen. Los nuevos y los que cambien de direccion los cubre
 * la Cloud Function `geocodificarCliente`; este script es el arranque.
 *
 * Usa EXACTAMENTE la misma logica que la function: la carga compilada desde
 * functions/lib, asi que primero hay que compilar:
 *     cd ../functions && npm run build
 *
 * Uso:
 *     node geocodificar-clientes.js                 # ensayo: consulta Google, NO escribe
 *     node geocodificar-clientes.js --limite 10     # ensayo con los primeros 10
 *     node geocodificar-clientes.js --commit        # escribe `geo`
 *     node geocodificar-clientes.js --commit --forzar   # recalcula aunque ya tengan `geo`
 *     node geocodificar-clientes.js --ciudad Soacha      # solo esa ciudad, recalculando (tras corregir `ciudad`)
 *
 * Nunca pisa un pin corregido a mano (geo.fuente = "manual") salvo que la
 * direccion haya cambiado.
 *
 * Key de servidor (Geocoding + Places): C:\keys\googleMapsServerKey.txt
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { geocodificarCliente, necesitaGeocodificar } = require('../functions/lib/mapa/geocodificar');

admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
const db = admin.firestore();

const KEY = fs.readFileSync('C:/keys/googleMapsServerKey.txt', 'utf8').trim();
const COMMIT = process.argv.includes('--commit');
const FORZAR = process.argv.includes('--forzar');
const iLimite = process.argv.indexOf('--limite');
const LIMITE = iLimite > 0 ? Number(process.argv[iLimite + 1]) : Infinity;
const iCiudad = process.argv.indexOf("--ciudad");
const CIUDAD = iCiudad > 0 ? process.argv[iCiudad + 1] : null;
const CSV = path.join(__dirname, `geocodificar-clientes-${COMMIT ? 'commit' : 'ensayo'}.csv`);

(async () => {
  const snap = await db.collection('clientes').get();
  const pendientes = snap.docs.filter((d) => {
    const c = d.data();
    if (c.geo?.fuente === 'manual' && c.geo?.direccionOrigen === String(c.direccion ?? '').trim()) return false;
    if (CIUDAD) return c.ciudad === CIUDAD && !!(c.direccion || c.nombre);
    return FORZAR ? !!(c.direccion || c.nombre) : necesitaGeocodificar(c);
  }).slice(0, LIMITE);

  console.log(`${COMMIT ? 'COMMIT' : 'ENSAYO (no escribe)'} · clientes: ${snap.size} · a calcular: ${pendientes.length}\n`);

  const cuenta = { ok: 0, revisar: 0, sin_resultado: 0, error: 0 };
  const filas = [['estado', 'activo', 'nombre', 'direccion', 'consulta', 'resultado Google', 'municipio', 'localidad', 'precision', 'fuente', 'motivo', 'lat', 'lng', 'id']];

  for (const doc of pendientes) {
    const c = doc.data();
    try {
      const geo = await geocodificarCliente(c, KEY);
      cuenta[geo.estado]++;
      const marca = { ok: '✔', revisar: '?', sin_resultado: '✘' }[geo.estado];
      console.log(`${marca} ${String(c.nombre || doc.id).slice(0, 55).padEnd(55)} ${geo.municipio ?? ''}${geo.localidad ? ' / ' + geo.localidad : ''}`);
      if (geo.estado !== 'ok') console.log(`    "${c.direccion || ''}" → ${geo.direccionFormateada ?? '—'}  (${geo.motivoRevision})`);
      filas.push([geo.estado, c.activo !== false, c.nombre || '', c.direccion || '', geo.consulta || '', geo.direccionFormateada || '',
        geo.municipio || '', geo.localidad || '', geo.precision || '', geo.fuente || '', geo.motivoRevision || '', geo.lat ?? '', geo.lng ?? '', doc.id]);

      if (COMMIT) {
        await doc.ref.update({ geo: { ...geo, actualizadoEn: admin.firestore.FieldValue.serverTimestamp() } });
      }
    } catch (e) {
      cuenta.error++;
      console.log(`! ${c.nombre || doc.id}: ${e.message}`);
      if (/REQUEST_DENIED|PERMISSION_DENIED|API key/i.test(e.message)) {
        console.log('\nLa key fue rechazada: revisa que Geocoding API y Places API (New) esten habilitadas y la key restringida solo a esas APIs.');
        break;
      }
    }
  }

  fs.writeFileSync(CSV, '\ufeff' + filas.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'));
  console.log(`\nok=${cuenta.ok}  revisar=${cuenta.revisar}  sin_resultado=${cuenta.sin_resultado}  error=${cuenta.error}`);
  console.log(`CSV: ${CSV}`);
  if (!COMMIT) console.log('Nada se escribio. Repite con --commit para guardar.');
  process.exit(0);
})();
