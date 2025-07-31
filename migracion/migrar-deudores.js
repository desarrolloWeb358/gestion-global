const admin = require('firebase-admin');
const mysql = require('mysql2/promise');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const main = async () => {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'gestion_2025',
    database: 'gestion_antigua',
  });

  console.log('✅ Conectado a MySQL');

  const snapshot = await db.collection('usuarios')
    .where('roles', 'array-contains', 'cliente')
    .get();

  for (const doc of snapshot.docs) {
    const clienteId = doc.id;
    const cliente = doc.data();
    const nit = cliente.numeroDocumento;

    if (!nit) continue;

    console.log(`🧠 Cliente ${cliente.nombre} (${nit})`);

    const [deudores] = await connection.execute(
      'SELECT usr_id, usr_nombre, usr_identificacion FROM scc_usuarios WHERE usr_identificacion LIKE ?',
      [`${nit}-%`]
    );

    for (const d of deudores) {
      const partes = d.usr_identificacion.split('-');
      if (partes.length < 2) continue;

      const ubicacion = partes[1];
      const deudorId = `${nit}-${ubicacion}`;

      // Obtener procesos del deudor
      const [procs] = await connection.execute(
        'SELECT pro_id FROM scc_proceso_has_usuarios WHERE usr_demandado_id = ?',
        [d.usr_id]
      );

      let proceso = null;
      if (procs.length > 0) {
        const ids = procs.map(p => p.pro_id);
        const [procesos] = await connection.execute(
          `SELECT * FROM scc_proceso WHERE pro_id IN (${ids.join(',')}) ORDER BY pro_creation_date DESC`
        );
        proceso = procesos[0];
      }

      // Obtener deuda total
      let deudaTotal = 0;
      if (proceso) {
        const [titulos] = await connection.execute(
          'SELECT tit_valor_de_entrega FROM scc_titulo WHERE pro_id = ?',
          [proceso.pro_id]
        );
        deudaTotal = titulos.reduce((sum, t) => sum + (t.tit_valor_de_entrega || 0), 0);
      }

      // Datos del deudor
      const deudor = {
        nombre: d.usr_nombre,
        ubicacion,
        correos: [],
        telefonos: [],
        estado: '',
        tipificacion: '',
        fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (deudaTotal > 0) deudor.deudaTotal = deudaTotal;
      if (proceso) {
        if (proceso.pro_numero) deudor.numeroProceso = proceso.pro_numero;
        if (proceso.pro_ano) deudor.anoProceso = proceso.pro_ano;
        if (proceso.juz_id) deudor.juzgadoId = proceso.juz_id;
      }

      // Crear o actualizar deudor
      const ref = db.collection('clientes').doc(clienteId).collection('deudores').doc(deudorId);
      await ref.set(deudor, { merge: true });

      console.log(`✅ Guardado deudor ${deudorId}`);

      // si tiene proceso
      if (proceso) {

        // abonos
        const [abonos] = await connection.execute(
          'SELECT abn_monto, abn_fecha, abn_observaciones, abn_comprobante_num FROM scc_abono WHERE pro_id = ?',
          [proceso.pro_id]
        );

        for (const abn of abonos) {
          const abono = {
            monto: Number(abn.abn_monto),
            fecha: abn.abn_fecha ? admin.firestore.Timestamp.fromDate(new Date(abn.abn_fecha)) : undefined,
            observaciones: abn.abn_observaciones || '',
            comprobante: abn.abn_comprobante_num ? Number(abn.abn_comprobante_num) : '',
            recibo: '',
            tipo: '',
          };

          await ref.collection('abonos').add(abono);
        }

        if (abonos.length > 0) {
          console.log(`➕ ${abonos.length} abonos añadidos a ${deudorId}`);
        }

        // 7. Migrar seguimientos
        const [seguimientos] = await connection.execute(
          'SELECT obp_observacion, tip_id, obp_fecha_observacion FROM scc_observacion_proceso WHERE pro_id = ?',
          [proceso.pro_id]
        );

        for (const seguimiento of seguimientos) {
          const descripcion = seguimiento.obp_observacion?.trim();
          const tipo = seguimiento.tip_id;
          const fechaRaw = seguimiento.obp_fecha_observacion;

          // Evitar seguimiento vacío
          if (!descripcion || !fechaRaw) continue;

          const seguimientoDoc = {
            descripcion,
            tipo,
            fecha: admin.firestore.Timestamp.fromDate(new Date(fechaRaw)),
            tipoSeguimiento: '', // vacío por ahora
            archivoUrl: ''       // vacío por ahora
          };

          await db
            .collection('clientes')
            .doc(clienteId)
            .collection('deudores')
            .doc(deudorId)
            .collection('seguimiento')
            .add(seguimientoDoc);

          console.log(`📌 Seguimiento agregado para deudor ${deudorId}`);
        }
      }
    }
  }

  console.log('🚀 Migración finalizada');
  await connection.end();
};

main();
