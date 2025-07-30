const admin = require('firebase-admin');
const mysql = require('mysql2/promise');

const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const main = async () => {
  try {
    // 1. Conexión a MySQL
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'gestion_2025',
      database: 'gestion_antigua',
    });

    console.log('✅ Conectado a MySQL');

    // 2. Obtener clientes desde colección usuarios con rol "cliente"
    const snapshot = await db.collection('usuarios').where('roles', 'array-contains', 'cliente').get();

    for (const doc of snapshot.docs) {
      const userData = doc.data();
      const clienteId = doc.id;
      const numeroDocumento = userData.numeroDocumento;

      if (!numeroDocumento) {
        console.warn(`⛔️ Cliente sin númeroDocumento: ${clienteId}`);
        continue;
      }

      console.log(`🔎 Buscando deudores para cliente ${clienteId} (${numeroDocumento})`);

      // 3. Consultar en MySQL los deudores por identificación LIKE 'numeroDocumento-%'
      const [rows] = await connection.execute(
        'SELECT usr_nombre, usr_identificacion FROM scc_usuarios WHERE usr_identificacion LIKE ?',
        [`${numeroDocumento}-%`]
      );

      for (const row of rows) {
        const nombre = row.usr_nombre;
        const identificacion = row.usr_identificacion;
        const partes = identificacion.split('-');

        if (partes.length < 2) {
          console.warn(`⚠️ Identificación mal formateada: ${identificacion}`);
          continue;
        }

        const ubicacion = partes[1];

        // 4. Crear documento en clientes/{clienteId}/deudores/
        await db
          .collection('clientes')
          .doc(clienteId)
          .collection('deudores')
          .add({
            nombre,
            ubicacion,
          });

        console.log(`✅ Deudor agregado para cliente ${clienteId}: ${nombre} - ${ubicacion}`);
      }
    }

    console.log('🚀 Migración de deudores completada');
  } catch (error) {
    console.error('❌ Error general en la migración:', error);
  }
};

main();
