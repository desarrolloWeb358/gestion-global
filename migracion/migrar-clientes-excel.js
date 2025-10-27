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

// ---- Utilidades ----
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
const normStr = (v) => (v === null || v === undefined ? '' : String(v).trim());
const toStrOrEmpty = (v) => (v === null || v === undefined ? '' : String(v));

(async function main() {
  let workbook, sheetName, sheet, rows = [];

  try {
    // 1) Leer Excel origen (AOA para preservar encabezados/orden)
    workbook = xlsx.readFile(excelPath, { cellDates: false });
    sheetName = workbook.SheetNames[0];
    sheet = workbook.Sheets[sheetName];

    const aoa = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!aoa.length) throw new Error('Hoja vacía');
    const headers = aoa[0].map(h => String(h).trim());

    // Posibles alias de campos
    const hIndex = (names) => {
      const set = headers.map(h => h.toLowerCase());
      for (const n of names) {
        const i = set.indexOf(n.toLowerCase());
        if (i !== -1) return i;
      }
      return -1;
    };

    const idxNombre = hIndex(['nombre', 'razon_social', 'razón social']);
    const idxNit = hIndex(['nit', 'NIT', 'neet', 'NEET']);
    const idxCorreo = hIndex(['correo', 'email', 'correo_electronico', 'correo electrónico']);
    const idxPass = hIndex(['contraseña', 'password', 'clave']);
    const idxTel = hIndex(['telefono', 'teléfono', 'phone']);
    const idxDir = hIndex(['direccion', 'dirección', 'address']);
    const idxBanco = hIndex(['banco']);
    const idxNCta = hIndex(['numero_cuenta', 'número_cuenta', 'numero cuenta', 'nro cuenta', 'nro_cuenta']);
    const idxTCta = hIndex(['tipo_cuenta', 'tipo cuenta']);

    const idxEjPreUID = hIndex(['ejecutivoPrejuridicoUID']);
    const idxEjJurUID = hIndex(['ejecutivoJuridicoUID']);


    // Asegurar columnas finales: UID y ERROR
    const UID_COL_NAME = 'UID';
    const ERROR_COL_NAME = 'ERROR';
    let uidCol = headers.indexOf(UID_COL_NAME);
    if (uidCol === -1) { headers.push(UID_COL_NAME); uidCol = headers.length - 1; }
    let errCol = headers.indexOf(ERROR_COL_NAME);
    if (errCol === -1) { headers.push(ERROR_COL_NAME); errCol = headers.length - 1; }

    // Convertir filas (AOA -> objetos mínimos) pero manteniendo orden
    rows = aoa.slice(1); // sin encabezado
    console.log(`📄 ${rows.length} registros leídos del archivo`);

    const updatedAoa = [headers];

    for (let r = 0; r < rows.length; r++) {
      const rowArr = Array.isArray(rows[r]) ? [...rows[r]] : [];
      // Expandir largo si hace falta (para poder escribir UID/ERROR)
      if (rowArr.length < headers.length) rowArr.length = headers.length;

      let status = 'PENDIENTE';
      let errorMessage = '';
      let uid = '';

      try {
        const nombre = normStr(idxNombre >= 0 ? rowArr[idxNombre] : '');
        // Permite alias NIT/NEET
        const nitRaw = idxNit >= 0 ? rowArr[idxNit] : '';
        const nit = normStr(nitRaw);
        const correo = normStr(idxCorreo >= 0 ? rowArr[idxCorreo] : '').toLowerCase();
        const contraseña = toStrOrEmpty(idxPass >= 0 ? rowArr[idxPass] : '');
        const telefono = toStrOrEmpty(idxTel >= 0 ? rowArr[idxTel] : '');
        const direccion = toStrOrEmpty(idxDir >= 0 ? rowArr[idxDir] : '');
        const banco = toStrOrEmpty(idxBanco >= 0 ? rowArr[idxBanco] : '');
        const numero_cuenta = toStrOrEmpty(idxNCta >= 0 ? rowArr[idxNCta] : '');
        const tipo_cuenta = toStrOrEmpty(idxTCta >= 0 ? rowArr[idxTCta] : '');

        const ejecutivoPrejuridicoUID = toStrOrEmpty(idxEjPreUID >= 0 ? rowArr[idxEjPreUID] : '');
        const ejecutivoJuridicoUID = toStrOrEmpty(idxEjJurUID >= 0 ? rowArr[idxEjJurUID] : '');



        // ---- Validaciones previas
        if (!nit) throw new Error('FALTA_NIT');
        if (!correo) throw new Error('FALTA_CORREO');
        if (!isValidEmail(correo)) throw new Error('EMAIL_INVALIDO');
        if (!contraseña || String(contraseña).length < 6) throw new Error('PASSWORD_INVALIDA');

        let isNewUser = false;

        // 2) Buscar/crear en Auth
        try {
          const u = await auth.getUserByEmail(correo);
          uid = u.uid;
          status = 'OK';
          console.log(`🔁 Usuario ya existe: ${correo} (${uid})`);
        } catch (e) {
          if (e.code === 'auth/user-not-found') {
            // 🔍 1. Intentar localizar por NIT en usuarios
            let uidByNit = '';
            try {
              const snap = await db.collection('usuarios')
                .where('tipoDocumento', '==', 'NIT')
                .where('numeroDocumento', '==', nit)
                .limit(1)
                .get();

              if (!snap.empty) {
                uidByNit = snap.docs[0].id;
              }
            } catch (qErr) {
              throw new Error(`FIRESTORE_LOOKUP_NIT_ERROR: ${qErr.message}`);
            }

            if (uidByNit) {
              // 🧩 2. Ya existía por NIT → actualizar Auth con el nuevo correo
              try {
                await auth.updateUser(uidByNit, { email: correo, password: String(contraseña) });
                uid = uidByNit;
                status = 'UPDATED_EMAIL';
                console.log(`✳️ Usuario localizado por NIT y actualizado email: ${correo} (${uid})`);
              } catch (updErr) {
                if (updErr.code === 'auth/email-already-exists') {
                  throw new Error('AUTH_EMAIL_IN_USE');
                }
                throw new Error(`AUTH_UPDATE_ERROR: ${updErr.message}`);
              }
            } else {
              // 🆕 3. No existe ni por correo ni por NIT → crear usuario nuevo
              try {
                const created = await auth.createUser({ email: correo, password: String(contraseña) });
                uid = created.uid;
                isNewUser = true;
                status = 'CREATED';
                console.log(`✅ Usuario creado: ${correo} (${uid})`);
              } catch (eCreate) {
                throw new Error(`AUTH_CREATE_ERROR: ${eCreate.message}`);
              }
            }
          } else {
            throw new Error(`AUTH_LOOKUP_ERROR: ${e.message}`);
          }
        }

        const timestampNow = admin.firestore.Timestamp.now();

        // 3) usuarios/{uid}
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
            },
            { merge: true }
          );
        } catch (eUser) {
          throw new Error(`FIRESTORE_USUARIOS_ERROR: ${eUser.message}`);
        }

        // 4) Escribir/actualizar coleccion 'clientes'
        try {
          const timestampNow = admin.firestore.Timestamp.now();
          const clienteRef = db.collection('clientes').doc(uid);
          const clienteSnap = await clienteRef.get();
          const isNewClienteDoc = !clienteSnap.exists; // <-- ¿el doc clientes/{uid} existe?

          await clienteRef.set(
            {
              direccion,
              banco,
              numeroCuenta: numero_cuenta,
              tipoCuenta: tipo_cuenta,
              // Usa UID si viene, si no, cae al nombre:
              ejecutivoPrejuridicoId: ejecutivoPrejuridicoUID || ejecutivoPrejuridico,
              ejecutivoJuridicoId: ejecutivoJuridicoUID || ejecutivoJuridico,

              // Trazabilidad
              fechaActualizacion: timestampNow,
              ...(isNewClienteDoc ? { fechaCreacion: timestampNow } : {}),

              // 🔹 Marca de “nuevo” SOLO cuando es la primera vez que se crea el doc
              //    (o, si prefieres, también cuando el usuario fue creado en Auth: isNewUser)
              ...((isNewClienteDoc || isNewUser) ? { migrado: false } : {}),
            },
            { merge: true }
          );
        } catch (eCli) {
          throw new Error(`FIRESTORE_CLIENTES_ERROR: ${eCli.message}`);
        }

        // OK → escribir UID y dejar ERROR vacío
        rowArr[uidCol] = uid;
        rowArr[errCol] = '';
      } catch (eRow) {
        errorMessage = eRow?.message || String(eRow);
        rowArr[uidCol] = rowArr[uidCol] || '';
        rowArr[errCol] = errorMessage;
        console.warn(`⛔️ Error en fila ${r + 2}: ${errorMessage}`);
      } finally {
        // Normalizar largos y pushear
        if (rowArr.length < headers.length) rowArr.length = headers.length;
        updatedAoa.push(rowArr);
      }
    }

    // 5) Reemplazar la hoja original con la hoja actualizada
    const newSheet = xlsx.utils.aoa_to_sheet(updatedAoa);
    workbook.Sheets[sheetName] = newSheet;

    // 6) Escribir **el mismo archivo**
    xlsx.writeFile(workbook, excelPath);
    console.log(`📁 Archivo actualizado en: ${path.resolve(excelPath)}`);
  } catch (e) {
    console.error('❌ Error general:', e.message || e);
  }

  console.log('🚀 Proceso de migración finalizado');
})().catch((e) => {
  console.error('❌ Error no controlado:', e);
});
