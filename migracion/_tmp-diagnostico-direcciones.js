/* Solo lectura: calidad de `clientes.direccion` antes de geocodificar para el mapa. */
const admin = require('firebase-admin');
const fs = require('fs');
admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
const db = admin.firestore();

// Nomenclatura colombiana: "Calle 127 # 7-45", "Cra 7 No 127-45", "Av. Boyacá 12-30", "KR 7 127 45"
const VIA = /\b(calle|cll?|cl|carrera|cra|kra|kr|cr|carr|avenida|av|ak|ac|diagonal|dg|diag|transversal|tv|tr|trans|autopista|circular|cq)\b\.?/i;
const PLACA = /\d+\s*[a-z]?\s*(bis)?\s*[a-z]?\s*(#|no\.?|n°|nº|num\.?|número|numero)?\s*\d+\s*[a-z]?\s*[-–]\s*\d+/i;
const RURAL = /\b(km|kil[oó]metro|vereda|vda|finca|lote|v[ií]a)\b/i;

function clasificar(dir) {
  const d = (dir || '').trim();
  if (!d) return 'vacia';
  const via = VIA.test(d);
  const placa = PLACA.test(d);
  if (via && placa) return 'completa';
  if (RURAL.test(d)) return 'rural';
  if (via) return 'via_sin_placa';
  return 'no_reconocible';
}

(async () => {
  const [clientesSnap, franqSnap] = await Promise.all([
    db.collection('clientes').get(),
    db.collection('franquicias').get(),
  ]);
  const franq = Object.fromEntries(franqSnap.docs.map((d) => [d.id, d.data()]));

  console.log('Franquicias:');
  for (const [id, f] of Object.entries(franq)) {
    console.log(`  ${id}  "${f.nombre}"  ciudades=[${(f.ciudades || []).join(', ')}]  activo=${f.activo !== false}`);
  }
  console.log(`\nClientes totales: ${clientesSnap.size}\n`);

  const grupos = {};
  const porDireccion = {};
  const filas = [['franquicia', 'ciudad', 'activo', 'clase', 'nombre', 'direccion', 'id']];

  for (const doc of clientesSnap.docs) {
    const c = doc.data();
    const fid = c.franquiciaId || '(sin franquicia → bogota)';
    const fnom = franq[c.franquiciaId]?.nombre || fid;
    const clase = clasificar(c.direccion);
    const g = (grupos[fnom] ||= { total: 0, activos: 0, clases: {}, ciudades: {}, ejemplos: {} });
    g.total++;
    if (c.activo !== false) g.activos++;
    g.clases[clase] = (g.clases[clase] || 0) + 1;
    g.ciudades[c.ciudad || '(sin ciudad)'] = (g.ciudades[c.ciudad || '(sin ciudad)'] || 0) + 1;
    (g.ejemplos[clase] ||= []).length < 6 && g.ejemplos[clase].push(`${c.nombre || doc.id} → "${c.direccion || ''}"`);

    const clave = (c.direccion || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clave) (porDireccion[clave] ||= []).push(c.nombre || doc.id);
    filas.push([fnom, c.ciudad || '', c.activo !== false, clase, c.nombre || '', c.direccion || '', doc.id]);
  }

  for (const [fnom, g] of Object.entries(grupos)) {
    console.log(`══ ${fnom}: ${g.total} clientes (${g.activos} activos)`);
    console.log(`   ciudades: ${Object.entries(g.ciudades).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    console.log(`   formato:  ${Object.entries(g.clases).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    for (const [clase, ej] of Object.entries(g.ejemplos)) {
      console.log(`   · ${clase}:`);
      ej.forEach((e) => console.log(`       ${e}`));
    }
    console.log('');
  }

  const dup = Object.values(porDireccion).filter((l) => l.length > 1);
  console.log(`Direcciones repetidas entre clientes: ${dup.length}`);
  dup.slice(0, 15).forEach((l) => console.log(`   ${l.join('  |  ')}`));

  const out = process.argv[2];
  if (out) {
    const csv = filas.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    fs.writeFileSync(out, '﻿' + csv);
    console.log(`\nCSV: ${out}`);
  }
  process.exit(0);
})();
