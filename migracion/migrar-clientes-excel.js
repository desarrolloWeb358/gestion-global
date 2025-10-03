/* eslint-disable no-console */
const admin = require('firebase-admin');
const xlsx = require('xlsx');
const path = require('path');

// ---- Firebase Admin ----
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const auth = admin.auth();
const db = admin.firestore();

// ---- Archivos ----
const excelPath = process.env.INPUT || './Clientes.xlsx';
const outputPath =
  process.env.OUTPUT ||
  `./Clientes_migrados_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.xlsx`;

// ---- Utilidades ----
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  // Regex simple y suficiente para validación básica
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function normStr(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function toStrOrEmpty(v) {
  return v === null || v === undefined ? '' : String(v);
}

(async function main() {
  let data = [];
  const updatedData = [];
  const errores = []; // hoja opcional con los errores “planos”

  try {
    // 1) Leer Excel origen
    const workbook = xlsx.readFile(excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    data = xlsx.utils.sheet_to_json(sheet);
    console.log(`📄 ${data.length} registros leídos del archivo`);
  } catch (e) {
    console.error('❌ No se pudo leer el Excel de entrada:', e.message);
    // Igual generamos un Excel vacío con encabezados útiles
  }

  for (const rawRow of data) {
    // Clonamos para no perder columnas originales y agregar columnas de resultado
    const row = { ...rawRow };
    let status = 'PENDIENTE';
    let errorMessage = '';
    let uid = '';

    try {
      const nombre = normStr(row.nombre);
      const nit = normStr(row.nit);
      const correo = normStr(row.correo).toLowerCase();
      const contraseña = toStrOrEmpty(row.contraseña);
      const telefono = toStrOrEmpty(row.telefono);
      const direccion = toStrOrEmpty(row.direccion);
      const banco = toStrOrEmpty(row.banco);
      const numero_cuenta = toStrOrEmpty(row.numero_cuenta);
      const tipo_cuenta = toStrOrEmpty(row.tipo_cuenta);
      const ejecutivoPrejuridico = toStrOrEmpty(row.ejecutivoPrejuridico);
      const ejecutivoJuridico = toStrOrEmpty(row.ejecutivoJuridico);

      // ---- Validaciones previas (para evitar explotar en Auth) ----
      if (!isValidEmail(correo)) {
        throw new Error('Email inválido o mal formateado');
      }
      if (!contraseña || String(contraseña).length < 6) {
        // Firebase requiere mínimo 6 caracteres
        throw new Error('Contraseña ausente o con menos de 6 caracteres');
      }

      let isNewUser = false;

      // 2) Buscar/crear en Auth con manejo fino de errores
      try {
        const u = await auth.getUserByEmail(correo);
        uid = u.uid;
        status = 'OK'; // ya existía
        console.log(`🔁 Usuario ya existe: ${correo} (${uid})`);
      } catch (e) {
        if (e.code === 'auth/user-not-found') {
          try {
            const created = await auth.createUser({ email: correo, password: String(contraseña) });
            uid = created.uid;
            isNewUser = true;
            status = 'CREATED';
            console.log(`✅ Usuario creado: ${correo} (${uid})`);
          } catch (eCreate) {
            // Error real de creación (p. ej. email inválido)
            throw new Error(`Error creando usuario: ${eCreate.message}`);
          }
        } else {
          throw new Error(`Error consultando Auth: ${e.message}`);
        }
      }

      const timestampNow = admin.firestore.Timestamp.now();

      // 3) Escribir/actualizar coleccion 'usuarios'
      try {
        await db.collection('usuarios').doc(uid).set(
          {
            activo: true,
            email: correo,
            nombre,
            roles: ['cliente'],
            tipoDocumento: 'NIT',
            numeroDocumento: nit,
            telefonoUsuario: telefono,
            // fecha_registro solo si quisieras en creación:
            // ...(isNewUser ? { fecha_registro: timestampNow } : {}),
            ...(isNewUser ? { migrado: false } : {}),
          },
          { merge: true }
        );
      } catch (eUser) {
        throw new Error(`Error escribiendo documento 'usuarios/${uid}': ${eUser.message}`);
      }

      // 4) Escribir/actualizar coleccion 'clientes'
      try {
        await db.collection('clientes').doc(uid).set(
          {
            direccion,
            banco,
            numeroCuenta: numero_cuenta,
            tipoCuenta: tipo_cuenta,
            ejecutivoPrejuridicoId: ejecutivoPrejuridico,
            ejecutivoJuridicoId: ejecutivoJuridico,
            // Si quieres trazar cuándo se tocó por última vez:
            fechaActualizacion: timestampNow,
          },
          { merge: true }
        );
      } catch (eCli) {
        throw new Error(`Error escribiendo documento 'clientes/${uid}': ${eCli.message}`);
      }

      // Si llegamos aquí, todo bien para esta fila
      row.uid = uid;
      row.status = status;
      row.error = '';
    } catch (eRow) {
      // Atrapamos el error por fila y continuamos
      errorMessage = eRow?.message || String(eRow);
      row.uid = row.uid || '';
      row.status = 'ERROR';
      row.error = errorMessage;

      errores.push({
        nombre: row.nombre || '',
        correo: row.correo || '',
        nit: row.nit || '',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      console.warn(`⛔️ Error en fila (${row.correo || row.nombre || 'sin-id'}): ${errorMessage}`);
    } finally {
      // Siempre empujamos la fila con su status
      updatedData.push(row);
    }
  }

  // 5) Siempre generamos Excel de salida, haya o no errores
  try {
    const wbOut = xlsx.utils.book_new();
    const shMigrados = xlsx.utils.json_to_sheet(updatedData);
    xlsx.utils.book_append_sheet(wbOut, shMigrados, 'Migrados');

    if (errores.length > 0) {
      const shErrores = xlsx.utils.json_to_sheet(errores);
      xlsx.utils.book_append_sheet(wbOut, shErrores, 'Errores');
    }

    xlsx.writeFile(wbOut, outputPath);
    console.log(`📁 Archivo actualizado: ${path.resolve(outputPath)}`);
  } catch (eOut) {
    console.error('❌ No se pudo escribir el Excel de salida:', eOut.message);
  }

  console.log('🚀 Proceso de migración finalizado');
})().catch((e) => {
  // Nunca dejamos el proceso caer sin reportar
  console.error('❌ Error no controlado:', e);
});
