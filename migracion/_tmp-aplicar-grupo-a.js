/*
 * Grupo A del analisis de ubicaciones (30-sep-2026), aprobado por el usuario.
 * Solo toca `direccion` y/o `ciudad`, y solo si el valor actual es el que se
 * vio en el analisis (si alguien lo cambio entretanto, lo salta y avisa).
 *   node _tmp-aplicar-grupo-a.js            # muestra lo que haria
 *   node _tmp-aplicar-grupo-a.js --commit   # escribe
 */
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
const db = admin.firestore();
const COMMIT = process.argv.includes('--commit');
const FRANQUICIA = 'LQZ0v6BorErqeO284X86';

// [parte del nombre, direccion esperada hoy, cambios]
const CAMBIOS = [
  ['CONJUNTO RESIDENCIAL HORTENSIA', 'Calle 33 # 39 – 95', { ciudad: 'Soacha' }],
  ['CONJUNTO RESIDENCIAL DALIA', 'Carrera. 31 este #41-99', { ciudad: 'Soacha' }],
  ['VIZCAYA CASTILLA RESERVADO', 'CARRERA 8A 90A-67', { direccion: 'Calle 8A # 90A-67' }],
  ['TORRES DE SAN ISIDRO', 'Carrera 69D # 151 Sur', { direccion: 'Carrera 69D # 1-51 Sur' }],
  ['CONJUNTO RESIDENCIAL ALBACETE', 'la Calle 165 sur # 52 - 54', { direccion: 'Calle 165 # 52-54' }],
  ['AGRUPACION VIGIA DEL PARQUE ETAPA 1', '', { direccion: 'Carrera 72H Bis # 42F-12 Sur' }],
  ['SANTA MARIA DEL SALITRE', '', { direccion: 'Carrera 68B # 23-50' }],
  ['PARQUES DE CASTILLA 7', '', { direccion: 'Carrera 79A # 11A-40' }],
  ['UNIDAD RESIDENCIAL VILLA EMILIA', '', { direccion: 'Carrera 69B # 17-59 Sur' }],
  ['VIVIENDA ACACIA', 'CALLE 34 No.38SUR -161 SOACHA', { direccion: 'Calle 34A # 38-161' }],
  ['BRISAS DE CASTILLA', 'Calle 10a # 81 d - 15', { direccion: 'Calle 10 # 81B-55' }],
  ['CONJUNTO RESIDENCIAL SANTA INES', 'Calle 28ª Bis 8-19 Este', { direccion: 'Calle 28A Bis Sur # 8-19 Este' }],
  ['CONJUNTO RESIDENCIAL PALO ROSA', 'Carrera 1 # 30 -78', { ciudad: 'Soacha', direccion: 'Calle 37 # 38-161' }],
  ['PUNTA DEL ESTE ETAPA 1 Y 2', 'Calle 54 A Sur No. 37 - 81', { direccion: 'Calle 13 Sur # 14-61 Este' }],
  // #15 Condominios II de Tierra Buena: no cambia texto; su pin se aprueba despues del recalculo.
];

(async () => {
  const snap = await db.collection('clientes').where('franquiciaId', '==', FRANQUICIA).get();
  const activos = snap.docs.filter((d) => d.data().activo !== false);
  for (const [parte, esperada, cambios] of CAMBIOS) {
    const hallados = activos.filter((d) => (d.data().nombre || '').includes(parte));
    if (hallados.length !== 1) { console.log(`✘ ${parte}: ${hallados.length} coincidencias, se salta`); continue; }
    const d = hallados[0], c = d.data();
    if (String(c.direccion || '').trim() !== esperada.trim()) {
      console.log(`✘ ${c.nombre}: la direccion ya no es "${esperada}" (hoy: "${c.direccion}"), se salta`);
      continue;
    }
    const txt = Object.entries(cambios).map(([k, v]) => `${k}: "${c[k] ?? ''}" → "${v}"`).join('  ·  ');
    console.log(`${COMMIT ? '✔' : '·'} ${c.nombre}\n    ${txt}`);
    if (COMMIT) await d.ref.update(cambios);
  }
  if (!COMMIT) console.log('\nNada se escribio. Repite con --commit.');
  process.exit(0);
})();
