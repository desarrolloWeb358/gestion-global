// Medicion de costo del job recordatorioCuotasAcuerdo.
// Usa count() (agregacion) para no pagar una lectura por documento.
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
const db = admin.firestore();

(async () => {
  const contar = async (q) => {
    try { return (await q.count().get()).data().count; }
    catch (e) { return `sin indice (${e.code})`; }
  };

  const clientes = await contar(db.collection('clientes'));
  const deudores = await contar(db.collectionGroup('deudores'));
  const acuerdos = await contar(db.collectionGroup('acuerdos'));
  const cuotas = await contar(db.collectionGroup('cuotas'));

  // El indice compuesto todavia no esta desplegado: se cuenta solo por estado,
  // que en la practica es el mismo numero (esActivo acompana a EN_FIRME).
  const vigentes = await contar(
    db.collectionGroup('acuerdos').where('estado', '==', 'EN_FIRME')
  );

  console.log('clientes .................', clientes);
  console.log('deudores (todos) .........', deudores);
  console.log('acuerdos (todos) .........', acuerdos);
  console.log('acuerdos EN_FIRME activos ', vigentes);
  console.log('cuotas (todas) ...........', cuotas);

  // Cuotas por acuerdo vigente: se mide sobre una muestra de 20 acuerdos.
  const muestra = await db.collectionGroup('acuerdos')
    .where('estado', '==', 'EN_FIRME')
    .limit(20)
    .get();

  let totalCuotasMuestra = 0;
  for (const a of muestra.docs) {
    totalCuotasMuestra += await contar(a.ref.collection('cuotas'));
  }
  const promedio = muestra.size ? totalCuotasMuestra / muestra.size : 0;

  console.log('muestra de acuerdos ......', muestra.size);
  console.log('cuotas/acuerdo (promedio) ', promedio.toFixed(1));
  console.log('');
  console.log('--- COSTO DIARIO ---');
  console.log('Plan A (actual, recorre acuerdos vigentes):',
    Math.round(vigentes + vigentes * promedio), 'lecturas/dia');
  console.log('Plan B (collectionGroup sobre cuotas): solo las cuotas que vencen ese dia');

  await admin.app().delete();
})().catch((e) => { console.error(e); process.exit(1); });
