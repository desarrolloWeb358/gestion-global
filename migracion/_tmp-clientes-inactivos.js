/* Solo lectura: usuarios INACTIVOS y qué cartera conservan. */
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
const db = admin.firestore();

const CAMPOS = [
  ['ejecutivoPrejuridicoId', 'Ejec. prejurídico'],
  ['ejecutivoJuridicoId', 'Ejec. jurídico'],
  ['ejecutivoDependienteId', 'Dependiente'],
  ['abogadoId', 'Abogado'],
  ['dependienteAbogadoId', 'Dep. abogado'],
];

(async () => {
  const [clientesSnap, usuariosSnap, particularesSnap, tareasSnap] = await Promise.all([
    db.collection('clientes').get(),
    db.collection('usuarios').get(),
    db.collection('clientesParticulares').get(),
    db.collection('tareas').get(),
  ]);

  const inactivos = usuariosSnap.docs.filter((d) => d.data().activo === false);
  console.log(`Usuarios totales: ${usuariosSnap.docs.length}  ·  INACTIVOS: ${inactivos.length}\n`);

  for (const d of inactivos) {
    const u = d.data();
    const roles = (u.roles || []).join(', ') || '(sin roles)';
    console.log(`── ${String(u.nombre || u.email || d.id)}   [${roles}]`);
    console.log(`     uid: ${d.id}   ${u.email || ''}`);

    let total = 0;
    for (const [campo, label] of CAMPOS) {
      const asignados = clientesSnap.docs.filter((c) => c.data()[campo] === d.id);
      if (!asignados.length) continue;
      const act = asignados.filter((c) => c.data().activo !== false).length;
      total += asignados.length;
      console.log(`     ${label.padEnd(18)} ${asignados.length} conjuntos  (${act} activos)`);
      asignados
        .filter((c) => c.data().activo !== false)
        .forEach((c) => console.log(`         → ACTIVO: ${String(c.data().nombre || c.id)}`));
    }

    const casos = particularesSnap.docs.filter(
      (c) => c.data().abogadoId === d.id || c.data().dependienteId === d.id
    );
    if (casos.length) {
      total += casos.length;
      console.log(`     Casos              ${casos.length} clientes particulares`);
    }

    const tareas = tareasSnap.docs.filter(
      (t) => t.data().asignadoA === d.id && t.data().estado !== 'finalizada'
    );
    if (tareas.length) {
      total += tareas.length;
      console.log(`     Tareas vivas       ${tareas.length}`);
    }

    const notis = await db
      .collection(`usuarios/${d.id}/notificaciones`)
      .where('visto', '==', false)
      .get();
    const pendientes = notis.docs.filter((n) => n.data().resuelta !== true).length;
    if (pendientes) console.log(`     Alertas sin ver    ${pendientes}`);

    console.log(total || pendientes ? `     TOTAL A REASIGNAR: ${total}` : '     ✓ sin cartera pendiente');
    console.log('');
  }

  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
