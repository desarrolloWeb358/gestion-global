/*
 * Solo lectura: analisis completo de ubicacion de los conjuntos ACTIVOS de
 * Cundinamarca. Para cada uno cruza tres fuentes:
 *   1) la direccion registrada (misma logica que la Cloud Function),
 *   2) una busqueda por NOMBRE en Google Places, aunque la direccion haya salido bien,
 *   3) el campo `ciudad` del sistema,
 * y dice que le falta: nada, ciudad, direccion o pin manual.
 * No escribe en Firestore. Deja un CSV para revisar en Excel.
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const g = require('../functions/lib/mapa/geocodificar');

admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
const db = admin.firestore();
const KEY = fs.readFileSync('C:/keys/googleMapsServerKey.txt', 'utf8').trim();
const FRANQUICIA = 'LQZ0v6BorErqeO284X86'; // Cundinamarca
const LEJOS_M = 400; // direccion y nombre a mas de esto = no son el mismo sitio

function metros(a, b) {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
const mapa = (p) => (p ? `https://www.google.com/maps?q=${p.lat},${p.lng}` : '');
const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

(async () => {
  const snap = await db.collection('clientes').where('franquiciaId', '==', FRANQUICIA).get();
  const activos = snap.docs.filter((d) => d.data().activo !== false);
  console.log(`Activos de Cundinamarca: ${activos.length}\n`);

  const filas = [];
  for (const doc of activos) {
    const c = doc.data();
    const nombre = g.limpiarNombre(c.nombre || '');
    const ciudad = c.ciudad || 'Bogotá';
    const dir = String(c.direccion || '').trim();

    const geo = await g.geocodificarCliente(c, KEY);
    let porNombre = null;
    try {
      const p = nombre ? await g.porNombre(`${nombre}, ${ciudad}, Colombia`, KEY) : null;
      if (p && g.nombreCoincide(nombre, p.nombreGoogle)) {
        porNombre = { ...p, municipio: g.detectarMunicipio(p.direccionFormateada || '', null).nombre };
      }
    } catch (e) { /* sin busqueda por nombre */ }

    const ptoDir = geo.fuente === 'direccion' && geo.lat != null ? { lat: geo.lat, lng: geo.lng } : null;
    const ptoNom = porNombre ? { lat: porNombre.lat, lng: porNombre.lng } : null;
    const dist = ptoDir && ptoNom ? metros(ptoDir, ptoNom) : null;
    const municipioReal = ptoDir ? geo.municipio : porNombre?.municipio ?? null;

    let cat, accion, detalle = '';
    if (!dir) {
      if (porNombre) {
        cat = 'DIRECCION';
        accion = `Completar direccion (Google por nombre: "${porNombre.direccionFormateada}")`;
      } else {
        cat = 'PIN';
        accion = 'Sin direccion y Google no lo encuentra por nombre: escribir la direccion o poner el pin a mano';
      }
    } else if (ptoDir && dist != null && dist > LEJOS_M) {
      cat = 'CONFLICTO';
      accion = `La direccion y el nombre caen a ${km(dist)}: confirmar cual es la correcta`;
      detalle = `Por direccion: ${geo.direccionFormateada} | Por nombre: "${porNombre.nombreGoogle}" ${porNombre.direccionFormateada}`;
    } else if (ptoDir && geo.estado === 'ok') {
      cat = 'OK';
      accion = dist != null ? `Bien (el nombre lo confirma a ${km(dist)})` : 'Bien';
    } else if (ptoDir) {
      cat = 'PIN';
      accion = `Confirmar el pin en el mapa: ${geo.motivoRevision}`;
      if (dist != null) accion += ` (el nombre lo confirma a ${km(dist)})`;
    } else if (porNombre) {
      cat = 'DIRECCION';
      accion = `Google no reconoce la direccion registrada; por nombre esta en "${porNombre.direccionFormateada}"`;
      detalle = geo.motivoRevision || '';
    } else {
      cat = 'PIN';
      accion = 'Google no encuentra ni la direccion ni el nombre: corregir la direccion o poner el pin a mano';
      detalle = geo.motivoRevision || '';
    }

    // La ciudad se revisa aparte: puede sumarse a cualquier otra accion.
    let ciudadSugerida = '';
    if (municipioReal && municipioReal !== ciudad) ciudadSugerida = municipioReal;
    if (ciudadSugerida && cat === 'OK') cat = 'CIUDAD';
    // Si el unico reparo de Google era el municipio, el pin esta bien: falta la ciudad.
    if (ciudadSugerida && cat === 'PIN' && /^Quedo en [^.]+$/.test(geo.motivoRevision || '')) {
      cat = 'CIUDAD';
      accion = 'Bien ubicado; solo falta la ciudad';
    }

    filas.push({
      cat, nombre: c.nombre || doc.id, ciudad, direccion: dir, accion,
      ciudadSugerida, detalle, distancia: dist != null ? km(dist) : '',
      mapaDireccion: mapa(ptoDir), mapaNombre: mapa(ptoNom), id: doc.id,
    });
    process.stdout.write('.');
  }
  console.log('\n');

  const orden = ['CONFLICTO', 'CIUDAD', 'DIRECCION', 'PIN', 'OK'];
  filas.sort((a, b) => orden.indexOf(a.cat) - orden.indexOf(b.cat) || a.nombre.localeCompare(b.nombre));
  for (const cat of orden) {
    const grupo = filas.filter((f) => f.cat === cat);
    console.log(`\n══ ${cat}: ${grupo.length}`);
    if (cat === 'OK') continue;
    for (const f of grupo) {
      console.log(`• ${f.nombre}  [${f.ciudad}]  "${f.direccion || 'sin direccion'}"`);
      console.log(`    → ${f.accion}${f.ciudadSugerida ? `  · CIUDAD: ${f.ciudad} → ${f.ciudadSugerida}` : ''}`);
      if (f.detalle) console.log(`      ${f.detalle}`);
    }
  }

  const cols = ['cat', 'nombre', 'ciudad', 'ciudadSugerida', 'direccion', 'accion', 'detalle', 'distancia', 'mapaDireccion', 'mapaNombre', 'id'];
  const csv = [cols.join(','), ...filas.map((f) => cols.map((k) => `"${String(f[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const out = path.join(__dirname, 'analisis-ubicaciones.csv');
  fs.writeFileSync(out, '\ufeff' + csv);
  console.log(`\nCSV: ${out}`);
  process.exit(0);
})();
