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
    .where('migrado', '!=', true)
    .get();

  for (const doc of snapshot.docs) {
    const clienteId = doc.id;
    const cliente = doc.data();
    const nit = cliente.numeroDocumento;

    if (!nit) continue;

    // Buscar cliente en MySQL
    const [clientesSQL] = await connection.execute(
      'SELECT usr_id FROM scc_usuarios WHERE usr_identificacion = ?',
      [nit]
    );

    if (clientesSQL.length === 0) {
      console.warn(`❌ Cliente no encontrado en MySQL: ${nit}`);
      continue;
    }

    console.log(` cantidad de clientes con el mismo nit: ${clientesSQL.length} `);

    const afiliadoId = clientesSQL[0].usr_id;
    const [procesos] = await connection.execute(
      'SELECT * FROM scc_proceso WHERE usr_afiliado_id = ?',
      [afiliadoId]
    );

    for (const proceso of procesos) {
      const [demandados] = await connection.execute(
        'SELECT usr_demandado_id FROM scc_proceso_has_usuarios WHERE pro_id = ?',
        [proceso.pro_id]
      );

      for (const row of demandados) {
        const demandadoId = row.usr_demandado_id;

        const [usuarios] = await connection.execute(
          'SELECT usr_nombre, usr_identificacion FROM scc_usuarios WHERE usr_id = ?',
          [demandadoId]
        );

        if (usuarios.length === 0) continue;

        const usuario = usuarios[0];
        const partes = usuario.usr_identificacion.split('-');
        const ubicacion = partes[1] || '';

        // Consultar teléfonos
        const [telefonosRows] = await connection.execute(
          'SELECT tlu_numero FROM scc_tel_usuarios WHERE usr_id = ?',
          [demandadoId]
        );
        const telefonos = telefonosRows.map(row => row.tlu_numero).filter(Boolean);

        // Consultar dirección (solo la primera)
        const [direccionRows] = await connection.execute(
          'SELECT diru_direccion FROM scc_dir_usuarios WHERE usr_id = ? LIMIT 1',
          [demandadoId]
        );
        const direccion = direccionRows.length > 0 && direccionRows[0].diru_direccion ? direccionRows[0].diru_direccion : '';


        // Deuda total
        const [titulos] = await connection.execute(
          'SELECT tit_valor_de_entrega FROM scc_titulo WHERE pro_id = ?',
          [proceso.pro_id]
        );
        const deudaTotal = titulos.reduce((sum, t) => sum + (t.tit_valor_de_entrega || 0), 0);

        const deudor = {
          nombre: usuario.usr_nombre,
          ubicacion,
          direccion,
          telefonos,
          correos: [],          
          estado: '',
          tipificacion: '',
          fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (deudaTotal > 0) deudor.deudaTotal = deudaTotal;
        if (proceso.pro_numero) deudor.numeroProceso = proceso.pro_numero;
        if (proceso.pro_ano) deudor.anoProceso = proceso.pro_ano;
        if (proceso.juz_id) deudor.juzgadoId = proceso.juz_id;

        const deudorRef = await db.collection('clientes').doc(clienteId).collection('deudores').add(deudor);
        console.log(`✅ Deudor migrado: ${deudor.nombre} (${deudorRef.id})`);

        // Migrar abonos
        const [abonos] = await connection.execute(
          'SELECT abn_monto, abn_fecha, abn_observaciones, abn_comprobante_num FROM scc_abono WHERE pro_id = ?',
          [proceso.pro_id]
        );

        for (const abn of abonos) {
          const abono = {
            monto: Number(abn.abn_monto),
            fecha: abn.abn_fecha ? admin.firestore.Timestamp.fromDate(new Date(abn.abn_fecha)) : undefined,
            observaciones: abn.abn_observaciones || '',
            comprobante: abn.abn_comprobante_num || '', // "" si no hay número
            recibo: '',
            tipo: '',
          };

          await deudorRef.collection('abonos').add(abono);
        }

        if (abonos.length > 0) {
          console.log(`➕ ${abonos.length} abonos añadidos a deudor ${deudorRef.id}`);
        }

        // Migrar seguimientos
        const [seguimientos] = await connection.execute(
          'SELECT obp_observacion, tip_id, obp_fecha_observacion FROM scc_observacion_proceso WHERE pro_id = ?',
          [proceso.pro_id]
        );

        for (const seguimiento of seguimientos) {
          const descripcion = seguimiento.obp_observacion?.trim();
          const tipo = seguimiento.tip_id;
          const fechaRaw = seguimiento.obp_fecha_observacion;

          if (!descripcion || !fechaRaw) continue;

          const seguimientoDoc = {
            descripcion,
            tipo,
            fecha: admin.firestore.Timestamp.fromDate(new Date(fechaRaw)),
            tipoSeguimiento: '',
            archivoUrl: ''
          };

          await deudorRef.collection('seguimiento').add(seguimientoDoc);
        }

        if (seguimientos.length > 0) {
          console.log(` ${seguimientos.length} seguimientos añadidos a deudor ${deudorRef.id}`);
        }

      }
    }

    // 🔖 Marcar cliente como migrado
    await db.collection('usuarios').doc(clienteId).update({ migrado: true });
    console.log(`🟢 Cliente ${cliente.nombre} marcado como migrado`);
  }

  await connection.end();
  console.log('🚀 Migración completa');
};

main();
