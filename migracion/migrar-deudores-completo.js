// migrar-deudores-completo.js
/* eslint-disable no-console */
const admin = require('firebase-admin');
const mysql = require('mysql2/promise');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const serviceAccount = require('./serviceAccountKey.json');

// ====== PARAMETROS ======
const LIMIT = Number(process.env.LIMIT || process.argv[2] || 5); // Ej: LIMIT=10 node script.js  ó  node script.js 10
const OUT_FILE = process.env.OUTFILE || `reporte_migracion_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.xlsx`;

// ====== FIREBASE ======
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ====== MYSQL ======
const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASS || 'gestion_2025',
  database: process.env.MYSQL_DB  || 'gestion_octubre',
};

// ====== TIPIFICACION ======
const TIP_IDS_DEMANDA = new Set([39, 47, 85]);

function computeTipificacion(rows) {
  if (!rows || rows.length === 0) return '';

  const ids = rows
    .map(r => (r.tip_id === null ? null : Number(r.tip_id)))
    .filter(v => v === null || !Number.isNaN(v));

  // Prioridad: DEMANDA > ACUERDO > GESTIONANDO
  const hasDemanda = ids.some(v => v === null || TIP_IDS_DEMANDA.has(v));
  if (hasDemanda) return 'Demanda';

  const hasAcuerdo = ids.some(v => v === 2);
  if (hasAcuerdo) return 'Acuerdo';

  const allGestionando = ids.length > 0 && ids.every(v => v === 1);
  if (allGestionando) return 'Gestionando';

  return 'Gestionando'; // por defecto
}

// ====== RECOLECCION DE REPORTE ======
const resumenClientes = [];
const detalleDeudores = [];
const errores = [];

function logError(scope, info, err) {
  errores.push({
    timestamp: new Date().toISOString(),
    scope, // CLIENTE | PROCESO | DEUDOR | ESTADOS | SEGUIMIENTOS | FINAL | QUERY
    ...info,
    message: err?.message || String(err),
    stack: (err && err.stack) ? String(err.stack).slice(0, 1000) : ''
  });
  console.warn(`❌ [${scope}]`, info, err?.message || err);
}

async function main() {
  const connection = await mysql.createConnection(MYSQL_CONFIG);
  console.log('✅ Conectado a MySQL');

  // ---- Traer clientes por migrar con tope LIMIT ----
  let snapshot;
  let docs = [];
  try {
    // Algunos índices compuestos pueden ser necesarios para '!='; si falla, hacemos fallback sin limit en query.
    snapshot = await db.collection('usuarios')
      .where('roles', 'array-contains', 'cliente')
      .where('migrado', '!=', true)
      .orderBy('migrado')            // ayuda a Firestore con '!='
      .limit(LIMIT)                  // top N directamente desde Firestore
      .get();

    docs = snapshot.docs;
  } catch (e) {
    logError('QUERY', { note: 'Fallo query con .limit(). Se traerán todos y se aplicará tope en memoria.' }, e);
    snapshot = await db.collection('usuarios')
      .where('roles', 'array-contains', 'cliente')
      .where('migrado', '!=', true)
      .get();
    docs = snapshot.docs.slice(0, LIMIT); // tope en memoria
  }

  console.log(`▶️ Se migrarán ${docs.length} cliente(s) (tope LIMIT=${LIMIT})`);

  for (const doc of docs) {
    const clienteId = doc.id;
    const cliente = doc.data();
    const nit = cliente.numeroDocumento;
    const clienteNombre = cliente.nombre || '';

    const clienteRow = {
      clienteId,
      clienteNombre,
      nit,
      totalProcesos: 0,
      totalDeudores: 0,
      totalEstadosMensuales: 0,
      totalSeguimientos: 0,
      status: 'PENDIENTE',
      detalle: ''
    };

    if (!nit) {
      clienteRow.status = 'SKIP';
      clienteRow.detalle = 'Usuario/Cliente sin numeroDocumento (NIT)';
      resumenClientes.push(clienteRow);
      console.warn(`⚠️ Cliente ${clienteId} sin NIT. Se omite.`);
      continue;
    }

    try {
      // 1) Cliente (afiliado) en MySQL
      const [clientesSQL] = await connection.execute(
        'SELECT usr_id FROM scc_usuarios WHERE usr_identificacion = ?',
        [nit]
      );

      if (!clientesSQL || clientesSQL.length === 0) {
        clienteRow.status = 'NO_ENCONTRADO_MYSQL';
        clienteRow.detalle = `No se encontró afiliado en MySQL para NIT ${nit}`;
        resumenClientes.push(clienteRow);
        console.warn(`❌ Cliente no encontrado en MySQL: ${nit}`);
        continue;
      }

      const afiliadoId = clientesSQL[0].usr_id;

      // 2) Procesos del afiliado
      const [procesos] = await connection.execute(
        'SELECT * FROM scc_proceso WHERE usr_afiliado_id = ?',
        [afiliadoId]
      );
      clienteRow.totalProcesos = procesos.length;

      let algoMigrado = false;

      for (const proceso of procesos) {
        try {
          // 3) Deudores del proceso
          const [demandados] = await connection.execute(
            'SELECT usr_demandado_id FROM scc_proceso_has_usuarios WHERE pro_id = ?',
            [proceso.pro_id]
          );

          for (const row of demandados) {
            const demandadoId = row.usr_demandado_id;

            try {
              const [usuarios] = await connection.execute(
                'SELECT usr_nombre, usr_identificacion FROM scc_usuarios WHERE usr_id = ?',
                [demandadoId]
              );
              if (!usuarios || usuarios.length === 0) {
                logError('DEUDOR', { clienteId, nit, pro_id: proceso.pro_id, demandadoId }, new Error('Demandado sin registro en scc_usuarios'));
                continue;
              }

              const usuario = usuarios[0];
              const partes = String(usuario.usr_identificacion || '').split('-');
              const ubicacion = partes[1] || '';

              // Teléfonos (array)
              const [telefonosRows] = await connection.execute(
                'SELECT tlu_numero FROM scc_tel_usuarios WHERE usr_id = ?',
                [demandadoId]
              );
              const telefonos = (telefonosRows || [])
                .map(r => r.tlu_numero)
                .filter(Boolean);

              // Dirección (primera)
              const [direccionRows] = await connection.execute(
                'SELECT diru_direccion FROM scc_dir_usuarios WHERE usr_id = ? LIMIT 1',
                [demandadoId]
              );
              const direccion = (direccionRows?.[0]?.diru_direccion) || '';

              // 4) Crear deudor en Firestore
              const deudorData = {
                nombre: usuario.usr_nombre || '',
                ubicacion,
                direccion,
                telefonos,
                correos: [],
                estado: '',
                tipificacion: '',
                fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
                ...(proceso.pro_numero ? { numeroProceso: proceso.pro_numero } : {}),
                ...(proceso.pro_ano ? { anoProceso: proceso.pro_ano } : {}),
                ...(proceso.juz_id ? { juzgadoId: proceso.juz_id } : {}),
              };

              const deudorRef = await db.collection('clientes').doc(clienteId).collection('deudores').add(deudorData);
              algoMigrado = true;
              clienteRow.totalDeudores += 1;

              // 5) Deuda total (suma títulos)
              const [titulos] = await connection.execute(
                'SELECT tit_valor_de_entrega FROM scc_titulo WHERE pro_id = ?',
                [proceso.pro_id]
              );
              const deudaTotal = (titulos || []).reduce((sum, t) => sum + Number(t.tit_valor_de_entrega || 0), 0);

              // 6) Abonos por mes
              const [abonos] = await connection.execute(
                'SELECT abn_monto, abn_fecha, abn_observaciones, abn_comprobante_num FROM scc_abono WHERE pro_id = ?',
                [proceso.pro_id]
              );

              const porMes = new Map();
              for (const a of (abonos || [])) {
                if (!a.abn_fecha) continue;
                const d = new Date(a.abn_fecha);
                const mes = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
                if (!porMes.has(mes)) porMes.set(mes, []);
                porMes.get(mes).push(a);
              }

              let mesesCreados = 0;

              for (const [mes, lista] of porMes.entries()) {
                const sumaRecaudo = (lista || []).reduce((s, it) => s + Number(it.abn_monto || 0), 0);

                let comprobante = '';
                let observaciones = '';
                if (lista.length > 0) {
                  comprobante = lista[0].abn_comprobante_num ? String(lista[0].abn_comprobante_num) : '';
                  observaciones = lista[0].abn_observaciones || '';
                }

                const estadoDoc = {
                  mes,                        // "AAAA-MM"
                  deuda: Number(deudaTotal) || 0,
                  recaudo: Number(sumaRecaudo) || 0,
                  ...(comprobante ? { comprobante } : {}),
                  ...(observaciones ? { observaciones } : {}),
                };

                try {
                  await deudorRef.collection('estadosMensuales').doc(mes).set(estadoDoc, { merge: true });
                  mesesCreados += 1;
                  clienteRow.totalEstadosMensuales += 1;
                } catch (e) {
                  logError('ESTADOS', { clienteId, nit, pro_id: proceso.pro_id, deudorIdFS: deudorRef.id, mes }, e);
                }
              }

              // 8) Seguimientos + tipificación
              const [seguimientos] = await connection.execute(
                'SELECT obp_observacion, tip_id, obp_fecha_observacion FROM scc_observacion_proceso WHERE pro_id = ?',
                [proceso.pro_id]
              );

              const tipificacion = computeTipificacion(seguimientos);
              if (tipificacion) {
                try {
                  await deudorRef.update({ tipificacion });
                } catch (e) {
                  logError('DEUDOR', { clienteId, nit, pro_id: proceso.pro_id, deudorIdFS: deudorRef.id, note: 'update tipificacion' }, e);
                }
              }

              let segCount = 0;
              for (const s of (seguimientos || [])) {
                try {
                  const desc = s.obp_observacion?.trim();
                  const fechaRaw = s.obp_fecha_observacion;
                  if (!desc || !fechaRaw) continue;

                  const tipNum = s.tip_id === null ? null : Number(s.tip_id);
                  const esJuridico = (tipNum === null) || TIP_IDS_DEMANDA.has(tipNum);
                  const collectionName = esJuridico ? 'seguimientoJuridico' : 'seguimiento';

                  const seguimientoDoc = {
                    descripcion: desc,
                    fecha: admin.firestore.Timestamp.fromDate(new Date(fechaRaw)),
                    tipoSeguimiento: 'OTRO',
                    archivoUrl: ''
                  };

                  await deudorRef.collection(collectionName).add(seguimientoDoc);
                  segCount += 1;
                  clienteRow.totalSeguimientos += 1;
                } catch (e) {
                  logError('SEGUIMIENTOS', { clienteId, nit, pro_id: proceso.pro_id, deudorIdFS: deudorRef.id }, e);
                }
              }

              // Detalle por deudor al reporte
              detalleDeudores.push({
                clienteId,
                nit,
                deudorId: deudorRef.id,
                deudorNombre: deudorData.nombre,
                pro_id: proceso.pro_id,
                numeroProceso: proceso.pro_numero || '',
                anoProceso: proceso.pro_ano || '',
                juzgadoId: proceso.juz_id || '',
                deudaTotal,
                mesesCreados,
                seguimientosCreados: segCount,
                tipificacion
              });

              console.log(`✅ Deudor migrado: ${deudorData.nombre} (${deudorRef.id}) [meses=${mesesCreados}, seg=${segCount}]`);
            } catch (e) {
              logError('DEUDOR', { clienteId, nit, pro_id: proceso.pro_id, demandadoId }, e);
            }
          }
        } catch (e) {
          logError('PROCESO', { clienteId, nit, pro_id: proceso?.pro_id }, e);
        }
      }

      // Marcar cliente como migrado SOLO si hubo alguna creación efectiva
      if (algoMigrado) {
        await db.collection('usuarios').doc(clienteId).update({ migrado: true });
        clienteRow.status = 'MIGRADO';
        clienteRow.detalle = 'Marcado como migrado en usuarios.migrado=true';
        console.log(`🟢 Cliente ${clienteNombre || clienteId} marcado como migrado`);
      } else {
        clienteRow.status = 'SIN_DATOS';
        clienteRow.detalle = 'Se encontró afiliado, pero no se crearon deudores/estados/seguimientos';
        console.warn(`⚠️ Cliente ${clienteNombre || clienteId} sin datos migrables`);
      }

      resumenClientes.push(clienteRow);
    } catch (e) {
      logError('CLIENTE', { clienteId, nit }, e);
      // No marcar migrado si hubo error global del cliente
      resumenClientes.push({
        ...clienteRow,
        status: 'ERROR',
        detalle: e?.message || 'Error procesando cliente'
      });
    }
  }

  await connection.end();
  console.log('🚀 Migración finalizada. Generando Excel...');

  // ====== GENERAR EXCEL ======
  try {
    const wb = XLSX.utils.book_new();
    const shResumen = XLSX.utils.json_to_sheet(resumenClientes);
    const shDeudores = XLSX.utils.json_to_sheet(detalleDeudores);
    const shErrores = XLSX.utils.json_to_sheet(errores);

    XLSX.utils.book_append_sheet(wb, shResumen, 'ResumenClientes');
    XLSX.utils.book_append_sheet(wb, shDeudores, 'Deudores');
    XLSX.utils.book_append_sheet(wb, shErrores, 'Errores');

    const outPath = path.resolve(process.cwd(), OUT_FILE);
    XLSX.writeFile(wb, outPath);
    console.log(`📄 Reporte Excel creado: ${outPath}`);
  } catch (e) {
    logError('FINAL', { note: 'Generando Excel' }, e);
  }

  console.log('✅ Proceso completado.');
}

main().catch(e => {
  logError('FINAL', { note: 'main() unhandled' }, e);
  process.exit(1);
});
