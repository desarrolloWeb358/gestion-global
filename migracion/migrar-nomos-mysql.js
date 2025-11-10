// migrar-nomos-mysql.js
/* eslint-disable no-console */
const admin = require('firebase-admin');
const mysql = require('mysql2/promise');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const serviceAccount = require('./serviceAccountKey.json');

// ====== CONFIG FIJA (único origen: needs.xlsx) ======
const NEEDS_FILE = path.resolve(process.cwd(), 'migracionXnit.xlsx'); // ← único origen permitido
const OUT_FILE = path.resolve(process.cwd(), 'reporte_migracion.xlsx');

// ====== FIREBASE ======
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ====== MYSQL ======
const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASS || 'gestion_2025',
  database: process.env.MYSQL_DB || 'gl0vg3t1_n0mxy24',
};

// ====== TIPIFICACION ======
const TIP_IDS_DEMANDA = new Set([39, 47, 85]);

// ====== HELPERS DE LIMPIEZA (borrar deudores y sus subcolecciones) ======
async function deleteCollection(collRef, batchSize = 400) {
  // El Admin SDK ignora reglas; borra en lotes para evitar límites de escritura
  const docs = await collRef.listDocuments();
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = admin.firestore().batch();
    for (const docRef of docs.slice(i, i + batchSize)) batch.delete(docRef);
    await batch.commit();
  }
}

async function deleteDocWithSubcollections(docRef) {
  try {
    const subcols = await docRef.listCollections(); // p.ej. estadosMensuales, seguimiento, seguimientoJuridico
    for (const sub of subcols) await deleteCollection(sub);
    await docRef.delete();
  } catch (e) {
    logError('WIPE_DEUDOR', { deudorIdFS: docRef.id }, e);
  }
}

async function wipeDeudores(clienteId) {
  try {
    const deudoresColl = db.collection('clientes').doc(clienteId).collection('deudores');
    const deudorRefs = await deudoresColl.listDocuments();
    for (const ref of deudorRefs) await deleteDocWithSubcollections(ref);
    console.log(`🧹 Limpieza de deudores completada para cliente ${clienteId}`);
  } catch (e) {
    logError('WIPE_DEUDORES', { clienteId }, e);
  }
}

function computeTipificacion(rows) {
  if (!rows || rows.length === 0) return 'Gestionando';
  const ids = rows
    .map(r => (r.tip_id === null ? null : Number(r.tip_id)))
    .filter(v => v === null || !Number.isNaN(v));

  const hasDemanda = ids.some(v => v === null || TIP_IDS_DEMANDA.has(v));
  if (hasDemanda) return 'Demanda';
  const hasAcuerdo = ids.some(v => v === 2);
  if (hasAcuerdo) return 'Acuerdo';
  const allGestionando = ids.length > 0 && ids.every(v => v === 1);
  if (allGestionando) return 'Gestionando';
  return 'Gestionando';
}

function loadOrCreateWorkbook(filePath) {
  if (fs.existsSync(filePath)) {
    try { return XLSX.readFile(filePath); }
    catch (e) { console.warn(`⚠️ No se pudo leer ${filePath}. Se creará uno nuevo.`, e?.message || e); }
  }
  return XLSX.utils.book_new();
}

function appendRowsToSheet(wb, sheetName, rows) {
  if (!rows || rows.length === 0) return;
  let ws = wb.Sheets[sheetName];
  if (!ws) {
    ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return;
  }
  XLSX.utils.sheet_add_json(ws, rows, { origin: -1, skipHeader: true });
}

function toMesYYYYMM(value) {
  if (!value) return null;
  let d = null;
  if (value instanceof Date) {
    if (!isNaN(value.valueOf())) d = value;
  } else if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) d = new Date(`${s}T00:00:00`);
    else d = new Date(s);
  } else if (typeof value === "number") d = new Date(value);
  if (!d || isNaN(d.valueOf())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

// ====== RECOLECCION DE REPORTE ======
const resumenClientes = [];
const detalleDeudores = [];
const errores = [];

function logError(scope, info, err) {
  errores.push({
    timestamp: new Date().toISOString(),
    scope,
    ...info,
    message: err?.message || String(err),
    //stack: (err && err.stack) ? String(err.stack).slice(0, 1000) : '',
  });
  console.warn(`❌ [${scope}]`, info, err?.message || err);
}

// ====== ÚNICA FUENTE DE TARGETS: needs.xlsx (por NIT) ======
async function fetchClientsByNits(nits) {
  const results = [];
  for (const nit of nits) {
    try {
      const q = await db
        .collection('usuarios')
        .where('roles', 'array-contains', 'cliente')
        .where('numeroDocumento', '==', nit)
        .limit(1)
        .get();
      if (!q.empty) {
        const doc = q.docs[0];
        results.push({ id: doc.id, data: () => doc.data() });
      } else {
        logError('TARGETS', { nit, note: 'No encontrado por numeroDocumento' }, new Error('no existe'));
      }
    } catch (e) {
      logError('TARGETS', { nit, note: 'Error consultando por NIT' }, e);
    }
  }
  return results;
}

function readNeedsExcel(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontró el archivo ${path.basename(filePath)} en ${path.dirname(filePath)}`);
  }
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const nitKeys = ['nit', 'NIT', 'numeroDocumento', 'documento'];
  const nits = [];

  for (const r of rows) {
    for (const k of nitKeys) {
      if (r[k]) {
        nits.push(String(r[k]).trim());
        break;
      }
    }
  }

  const clean = Array.from(new Set(nits.filter(Boolean)));
  if (clean.length === 0) {
    throw new Error(`El archivo needs.xlsx no contiene una columna de NIT válida (${nitKeys.join(', ')}) o está vacío.`);
  }
  console.log(`🎯 Targets desde needs.xlsx: ${clean.length} NIT(s)`);
  return clean;
}

// funcion para traer los ejecutivos de la collecio de clientes
async function fetchEjecutivosCliente(clienteId) {
  try {
    const snap = await db.collection('clientes').doc(clienteId).get();

    if (!snap.exists) {
      logError('CLIENTE_EJECUTIVOS', { clienteId, note: 'clientes/{clienteId} no existe' }, new Error('not found'));
      return {};
    }

    const data = snap.data() || {};

    // Ajusta estos nombres según EXACTAMENTE como están en tu documento de clientes
    return {
      ejecutivoPrejuridicoId: data.ejecutivoPrejuridicoId  || null,
      ejecutivoJuridicoId: data.ejecutivoJuridicoId || null,      
    };
  } catch (e) {
    logError('CLIENTE_EJECUTIVOS', { clienteId }, e);
    return {};
  }
}

function extractUbicacion(idStrRaw, nitRaw) {
  const idStr = String(idStrRaw || '').trim();
  const nit = String(nitRaw || '').trim();
  if (!idStr || !nit) return idStr;

  // Si comienza con el NIT, elimínalo junto con un guion o espacio siguiente
  let rest = idStr.startsWith(nit)
    ? idStr.slice(nit.length).replace(/^[-\s]+/, '')
    : idStr;

  return rest.trim(); // limpia espacios finales o iniciales
}

// ====================== MAIN ======================
async function main() {
  // 1) Leer NITs exclusivamente del Excel needs.xlsx
  const nits = readNeedsExcel(NEEDS_FILE);

  // 2) Resolver clientes por NIT
  const docs = await fetchClientsByNits(nits);
  console.log(`▶️ Se migrarán ${docs.length} cliente(s) encontrados por NIT.`);

  const connection = await mysql.createConnection(MYSQL_CONFIG);
  console.log('✅ Conectado a MySQL');

  for (const doc of docs) {
    const clienteId = doc.id;
    const cliente = typeof doc.data === 'function' ? doc.data() : doc.data;
    const nit = cliente.numeroDocumento;    
    const clienteNombre = cliente.nombre || '';

    // Obtener ejecutivos configurados en clientes/{clienteId}
  const {
    ejecutivoPrejuridicoId,
    ejecutivoJuridicoId,    
  } = await fetchEjecutivosCliente(clienteId);

    const clienteRow = {
      //clienteId,
      clienteNombre,
      nit,      
      totalDeudores: 0,
      totalEstadosMensuales: 0,
      totalSeguimientos: 0,
      status: 'PENDIENTE',
      detalle: '',
    };

    try {
      if (!nit) {
        clienteRow.status = 'Cliente sin NIT)';
        resumenClientes.push(clienteRow);
        console.warn(`⚠️ Cliente ${clienteId} sin NIT. Se omite lógica de migración.`);
        continue; // el finally marcará migrado:true
      }

      // 1) Cliente (afiliado) en MySQL
      const [clientesSQL] = await connection.execute(
        'SELECT usr_id FROM scc_usuarios WHERE usr_identificacion = ?',
        [nit]
      );

      if (!clientesSQL || clientesSQL.length === 0) {
        clienteRow.status = 'NO ESTA EN NOMOS';
        resumenClientes.push(clienteRow);
        console.warn(`❌ Cliente no encontrado en MySQL: ${nit}`);
        continue; // el finally marcará migrado:true
      }

      const afiliadoId = clientesSQL[0].usr_id;
      
      // 2) Procesos del afiliado (ejemplo: activos esp_id = 1)
      const [procesos] = await connection.execute(
        'SELECT * FROM scc_proceso WHERE esp_id = 1 AND usr_afiliado_id = ?',
        [afiliadoId]
      );      

      // LIMPIEZA PREVIA DE DEUDORES
      //await wipeDeudores(clienteId);

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
              //console.log(' ubicacion raw:', usuario.usr_identificacion);
              const ubicacion = extractUbicacion(usuario.usr_identificacion, nit);
              //console.log('  ubicacion limpia:', ubicacion);

              // Teléfonos
              const [telefonosRows] = await connection.execute(
                'SELECT tlu_numero FROM scc_tel_usuarios WHERE usr_id = ?',
                [demandadoId]
              );
              const telefonos = (telefonosRows || []).map(r => r.tlu_numero).filter(Boolean);

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

              // 5) Título (un solo registro)
              const [tituloRows] = await connection.execute(
                `SELECT tit_valor_de_entrega, tit_fecha_de_expedicion
                   FROM scc_titulo
                  WHERE pro_id = ?
               ORDER BY tit_fecha_de_expedicion ASC
                  LIMIT 1`,
                [proceso.pro_id]
              );

              const titulo = tituloRows?.[0] || null;
              const deudaTitulo = titulo ? Number(titulo.tit_valor_de_entrega || 0) : 0;
              const deudaTotal = deudaTitulo;
              const mesDeuda = toMesYYYYMM(titulo?.tit_fecha_de_expedicion);

              // 6) Abonos por mes
              const [abonos] = await connection.execute(
                'SELECT abn_monto, abn_fecha, abn_observaciones, abn_comprobante_num FROM scc_abono WHERE pro_id = ?',
                [proceso.pro_id]
              );

              const porMes = new Map();
              for (const a of (abonos || [])) {
                if (!a.abn_fecha) continue;
                const mes = toMesYYYYMM(a.abn_fecha);
                if (!mes) continue;
                if (!porMes.has(mes)) porMes.set(mes, []);
                porMes.get(mes).push(a);
              }

              // Seguimientos + tipificación
              const [seguimientos] = await connection.execute(
                'SELECT obp_observacion, tip_id, obp_fecha_observacion FROM scc_observacion_proceso WHERE pro_id = ?',
                [proceso.pro_id]
              );

              const tipificacion = computeTipificacion(seguimientos);
              const porcentajeHonorariosEstados = (tipificacion === 'Demanda') ? 20 : 15;

              if (tipificacion) {
                try { await deudorRef.update({ tipificacion }); }
                catch (e) {
                  logError('DEUDOR', { clienteId, nit, pro_id: proceso.pro_id, deudorIdFS: deudorRef.id, note: 'update tipificacion' }, e);
                }
              }

              let mesesCreados = 0;

              // SOLO-DEUDA (sin abonos) → 15% en mes del título
              if (porMes.size === 0 && deudaTitulo > 0) {
                const porcentajeHonorarios = 15;
                const honorariosDeuda = Math.round((deudaTitulo * porcentajeHonorarios) / 100);
                const mesSoloDeuda =
                  mesDeuda ||
                  `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

                const estadoSoloDeuda = {
                  mes: mesSoloDeuda,
                  deuda: deudaTitulo,
                  recaudo: 0,
                  porcentajeHonorarios,
                  honorariosDeuda,
                  honorariosRecaudo: 0,
                };

                try {
                  await deudorRef.collection("estadosMensuales").doc(mesSoloDeuda).set(estadoSoloDeuda, { merge: true });
                  mesesCreados += 1;
                  clienteRow.totalEstadosMensuales += 1;
                } catch (e) {
                  logError("ESTADOS", { clienteId, nit, pro_id: proceso.pro_id, deudorIdFS: deudorRef.id, mes: mesSoloDeuda }, e);
                }
              }

              // Estados por cada mes con abonos (deuda + recaudo)
              for (const [mes, lista] of porMes.entries()) {
                const sumaRecaudo = (lista || []).reduce((s, it) => s + Number(it.abn_monto || 0), 0);

                let recibo = '';
                let observaciones = '';
                if (lista.length > 0) {
                  recibo = lista[0].abn_comprobante_num ? String(lista[0].abn_comprobante_num) : '';
                  observaciones = lista[0].abn_observaciones || '';
                }

                const porcentajeHonorarios = porcentajeHonorariosEstados; // 20% si Demanda; 15% caso contrario
                const honorariosDeuda = Math.round(((Number(deudaTotal) || 0) * porcentajeHonorarios) / 100);
                const honorariosRecaudo = 0;

                const estadoDoc = {
                  mes,
                  deuda: Number(deudaTotal) || 0,
                  recaudo: Number(sumaRecaudo) || 0,
                  porcentajeHonorarios,
                  honorariosDeuda,
                  honorariosRecaudo,
                  ...(recibo ? { recibo } : {}),
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

              // detalle del seguimiento prejuridico y juridico
              let segCount = 0;
              for (const s of (seguimientos || [])) {
                try {
                  const desc = s.obp_observacion?.trim();
                  const fechaRaw = s.obp_fecha_observacion;
                  if (!desc || !fechaRaw) continue;

                  const tipNum = s.tip_id === null ? null : Number(s.tip_id);
                  const esJuridico = (tipNum === null) || TIP_IDS_DEMANDA.has(tipNum);
                  const collectionName = esJuridico ? 'seguimientoJuridico' : 'seguimiento';
                  const ejecutivoID = esJuridico ? ejecutivoJuridicoId : ejecutivoPrejuridicoId;

                  const seguimientoDoc = {
                    descripcion: desc,
                    fecha: admin.firestore.Timestamp.fromDate(new Date(fechaRaw)),
                    fechaCreacion: admin.firestore.Timestamp.fromDate(new Date(fechaRaw)),
                    tipoSeguimiento: 'Otro',
                    archivoUrl: '',
                    clienteUID: clienteId,
                    ejecutivoUID: ejecutivoID || '',
                  };

                  await deudorRef.collection(collectionName).add(seguimientoDoc);
                  segCount += 1;
                  clienteRow.totalSeguimientos += 1;
                } catch (e) {
                  logError('SEGUIMIENTOS', { clienteId, nit, pro_id: proceso.pro_id, deudorIdFS: deudorRef.id }, e);
                }
              }

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
                tipificacion,
              });

              console.log(`✅ Deudor migrado: ${deudorData.nombre} (${deudorRef.id}) [meses=${mesesCreados}]`);
            } catch (e) {
              logError('DEUDOR', { clienteId, nit, pro_id: proceso.pro_id, demandadoId }, e);
            }
          }
        } catch (e) {
          logError('PROCESO', { clienteId, nit, pro_id: proceso?.pro_id }, e);
        }
      }

      if (clienteRow.totalDeudores === 0) {
        clienteRow.status = 'NO ENCONTRO DEUDORES';
      } else {
        clienteRow.status = 'OK';
      }

      resumenClientes.push(clienteRow);

    } catch (e) {
      logError('CLIENTE', { clienteId, nit }, e);
      resumenClientes.push({
        ...clienteRow,
        status: 'ERROR',
        detalle: e?.message || 'Error procesando cliente',
      });
    } finally {
      // === SIEMPRE marcar migrado:true en clientes/{clienteId} ===
      try {
        await db.collection('clientes').doc(clienteId).set({ migrado: true }, { merge: true });
        console.log(`🟢 Marcado migrado=true en clientes/${clienteId}`);
      } catch (markErr) {
        logError('FINAL', { clienteId, note: 'Marcando migrado:true en clientes' }, markErr);
      }
    }
  }

  await connection.end();
  console.log('🚀 Migración finalizada. Generando Excel...');

  try {
    const wb = loadOrCreateWorkbook(OUT_FILE);
    appendRowsToSheet(wb, 'ResumenClientes', resumenClientes);
    //appendRowsToSheet(wb, 'Deudores', detalleDeudores);
    appendRowsToSheet(wb, 'Errores', errores);
    XLSX.writeFile(wb, OUT_FILE);
    console.log(`📄 Reporte Excel actualizado: ${OUT_FILE}`);
  } catch (e) {
    logError('FINAL', { note: 'Generando/Actualizando Excel' }, e);
  }

  console.log('✅ Proceso completado.');
}

main().catch(e => {
  logError('FINAL', { note: 'main() unhandled' }, e);
  process.exit(1);
});
