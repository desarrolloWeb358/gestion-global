const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
const db = admin.firestore();
(async () => {
  const snap = await db.collection('clientes/HYzh7lnUoIdkW8grvIQGqSokXiZ2/deudores').get();
  const rows = snap.docs.map(d => ({
    id: d.id,
    create: d.createTime.toDate().toISOString(),
    nombre: String(d.data().nombre ?? ''),
  }));
  rows.sort((a, b) => a.create.localeCompare(b.create));
  for (const r of rows) console.log(r.create, r.id, JSON.stringify(r.nombre));

  // agrupar por segundo para ver si fue carga masiva
  const porSegundo = {};
  for (const r of rows) {
    const k = r.create.slice(0, 19);
    porSegundo[k] = (porSegundo[k] || 0) + 1;
  }
  console.log('\n--- docs por segundo de creacion ---');
  for (const [k, v] of Object.entries(porSegundo)) console.log(k, '->', v);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
