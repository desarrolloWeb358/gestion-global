const admin = require('firebase-admin');
const xlsx = require('xlsx');

// Inicializar Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();
const db = admin.firestore();

const excelPath = './Clientes.xlsx';
const outputPath = './Clientes_migrados.xlsx';

const main = async () => {
  try {
    const workbook = xlsx.readFile(excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    console.log(`📄 ${data.length} registros leídos del archivo`);

    const updatedData = [];

    for (const row of data) {
      const {
        nombre,
        nit,
        correo,
        contraseña,
        telefono,
        direccion,
        banco,
        numero_cuenta,
        tipo_cuenta,
        ejecutivoPrejuridico,
        ejecutivoJuridico
      } = row;

      if (!correo || !contraseña) {
        console.warn(`⛔️ Usuario omitido por falta de correo o contraseña: ${nombre}`);
        row.uid = 'ERROR: Sin correo o contraseña';
        updatedData.push(row);
        continue;
      }

      let uid;

      try {
        // Verificar si ya existe el usuario en Auth
        const existingUser = await auth.getUserByEmail(correo);
        uid = existingUser.uid;
        console.log(`🔁 Usuario ya existe: ${correo} (${uid})`);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          // Crear nuevo usuario en Auth
          const newUser = await auth.createUser({
            email: correo,
            password: String(contraseña),
          });
          uid = newUser.uid;
          console.log(`✅ Usuario creado: ${correo} (${uid})`);
        } else {
          console.error(`❌ Error consultando Auth para ${correo}:`, error.message);
          row.uid = `ERROR: ${error.message}`;
          updatedData.push(row);
          continue;
        }
      }

      const timestampNow = admin.firestore.Timestamp.now();

      // Crear o actualizar documento en 'usuarios'
      await db.collection('usuarios').doc(uid).set({
        activo: true,
        email: correo,
        nombre: nombre,
        roles: ['cliente'],
        fecha_registro: timestampNow,
        tipoDocumento: 'NIT',
        numeroDocumento: String(nit),
      }, { merge: true });

      // Crear o actualizar documento en 'clientes'
      await db.collection('clientes').doc(uid).set({
        nombre: nombre || '',
        telefono: String(telefono || ''),
        direccion: direccion || '',
        banco: banco || '',
        numeroCuenta: String(numero_cuenta || ''),
        tipoCuenta: tipo_cuenta || '',
        ejecutivoPrejuridicoId: String(ejecutivoPrejuridico || ''),
        ejecutivoJuridicoId: String(ejecutivoJuridico || ''),
      }, { merge: true });

      row.uid = uid;
      updatedData.push(row);
    }

    // Guardar archivo con columna UID
    const newSheet = xlsx.utils.json_to_sheet(updatedData);
    const newWorkbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(newWorkbook, newSheet, 'Migrados');
    xlsx.writeFile(newWorkbook, outputPath);

    console.log(`📁 Archivo actualizado: ${outputPath}`);
    console.log('🚀 Migración completada con validaciones');
  } catch (err) {
    console.error('❌ Error general en la migración:', err);
  }
};

main();
