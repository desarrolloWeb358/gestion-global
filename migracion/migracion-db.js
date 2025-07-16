
// migracion-db.js
const mysql = require('mysql2/promise');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');



// Inicializar Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const main = async () => {
  try {
    // Conectar a MySQL
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'gestion_2025',
      database: 'gestion_antigua', // asegúrate que ese sea el nombre
    });

    console.log('✅ Conectado a MySQL');

    // Leer 10 registros
    const [rows] = await connection.execute(
      'SELECT usr_nombre, usr_identificacion FROM scc_usuarios LIMIT 2'
    );

    console.log(`📦 Obtenidos ${rows.length} registros`);

    // Insertar en Firestore
    for (const row of rows) {
      const doc = {
        nombre: row.usr_nombre,
        identificacion: row.usr_identificacion,
      };

      await db.collection('usuarios').add(doc);
      console.log(`✅ Usuario guardado: ${doc.nombre}`);
    }

    console.log('🚀 Migración completada con éxito');

    await connection.end();
  } catch (error) {
    console.error('❌ Error en la migración:', error);
  }
};

main();
