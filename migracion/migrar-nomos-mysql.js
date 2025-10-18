// migrar-nomos-mysql.js
/* eslint-disable no-console */
const admin = require('firebase-admin');
const mysql = require('mysql2/promise');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const serviceAccount = require('./serviceAccountKey.json');

// ====== PARAMETROS ======
const argv = process.argv.slice(2).reduce((acc, cur) => {
  const [k, v] = cur.includes('=') ? cur.split('=') : [cur, true];
  const key = k.replace(/^--/, '');
  acc[key] = v === undefined ? true : v;
  return acc;
}, {});

const LIMIT = Number(process.env.LIMIT || argv.LIMIT || argv.limit || argv[0] || 1);
const OUT_FILE =
  process.env.OUTFILE ||
  `reporte_migracion_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.xlsx`;

const ARG_UID = argv.uid || process.env.CLIENT_UID || null;
const ARG_UIDS = (argv.uids || process.env.CLIENT_UIDS || '')
  .toString()
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const ARG_XLSX = argv.xlsx || process.env.CLIENTS_XLSX || null;

// ====== FIREBASE ======
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ====== MYSQL ======
const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASS || 'gestion_2025',
  database: process.env.MYSQL_DB || 'gestion_octubre',
};

// ====== TIPIFICACION ======
const TIP_IDS_DEMANDA = new Set([39, 47, 85]);

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

function toMesYYYYMM(value) {
  if (!value) return null;

  let d = null;

  // Caso 1: ya es un Date
  if (value instanceof Date) {
    if (!isNaN(value.valueOf())) d = value;
  }
  // Caso 2: string (por ejemplo "2025-05-21" o cualquier fecha compatible)
  else if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      d = new Date(`${s}T00:00:00`);
    } else {
      d = new Date(s);
    }
  }
  // Caso 3: timestamp numérico
  else if (typeof value === "number") {
    d = new Date(value);
  }

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
    scope, // CLIENTE | PROCESO | DEUDOR | ESTADOS | SEGUIMIENTOS | FINAL | QUERY | TARGETS
    ...info,
    message: err?.message || String(err),
    stack: (err && err.stack) ? String(err.stack).slice(0, 1000) : '',
  });
  console.warn(`❌ [${scope}]`, info, err?.message || err);
}

// -------- Helpers para targets (selección de clientes a migrar) --------

// Devuelve [{id, data}] como si fueran snapshot.docs (subset)
async function fetchClientsByIds(ids) {
  const results = [];
  for (const id of ids) {
    try {
      const ref = db.collection('usuarios').doc(id);
      const snap = await ref.get();
      if (snap.exists) {
        const data = snap.data() || {};
        // Asegurar rol cliente
        const roles = Array.isArray(data.roles) ? data.roles : [];
        if (roles.includes('cliente')) {
          results.push({ id: snap.id, data: () => data });
        } else {
          logError('TARGETS', { id, note: 'No tiene rol cliente' }, new Error('ROL_NO_CLIENTE'));
        }
      } else {
        logError('TARGETS', { id, note: 'No existe doc en usuarios' }, new Error('NO_DOC'));
      }
    } catch (e) {
      logError('TARGETS', { id, note: 'Error leyendo usuario por id' }, e);
    }
  }
  return results;
}

// Cuando desde Excel hay NIT: buscar por numeroDocumento (NIT)
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
        logError('TARGETS', { nit, note: 'No encontrado por numeroDocumento' }, new Error('NO_DOC_NIT'));
      }
    } catch (e) {
      logError('TARGETS', { nit, note: 'Error consultando por NIT' }, e);
    }
  }
  return results;
}

function readXlsxTargets(filePath) {
  const ids = new Set();
  const nits = new Set();
  try {
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    for (const r of rows) {
      // soporta: clienteId | uid | nit
      if (r.clienteId) ids.add(String(r.clienteId).trim());
      if (r.uid) ids.add(String(r.uid).trim());
      if (r.nit) nits.add(String(r.nit).trim());
    }
  } catch (e) {
    logError('TARGETS', { filePath }, e);
  }
  return { ids: Array.from(ids), nits: Array.from(nits) };
}

async function resolveTargetClients() {
  // 1) uid único
  if (ARG_UID) {
    console.log(`🎯 Target: UID único: ${ARG_UID}`);
    return await fetchClientsByIds([ARG_UID]);
  }

  // 2) uids CSV
  if (ARG_UIDS.length > 0) {
    console.log(`🎯 Target: Lista de UIDs (${ARG_UIDS.length})`);
    return await fetchClientsByIds(ARG_UIDS);
  }

  // 3) Excel
  if (ARG_XLSX) {
    console.log(`🎯 Target: Excel ${ARG_XLSX}`);
    const { ids, nits } = readXlsxTargets(ARG_XLSX);
    const byIds = ids.length ? await fetchClientsByIds(ids) : [];
    const byNits = nits.length ? await fetchClientsByNits(nits) : [];
    // Unificar por id
    const map = new Map();
    for (const d of [...byIds, ...byNits]) map.set(d.id, d);
    const arr = Array.from(map.values());
    console.log(`   → Resueltos desde Excel: ${arr.length} cliente(s)`);
    return arr;
  }

  // 4) Comportamiento original: LIMIT y migrado != true
  console.log(`🎯 Target: Query por LIMIT (migrado != true), LIMIT=${LIMIT}`);
  try {
    let snapshot;
    try {
      snapshot = await db
        .collection('usuarios')
        .where('roles', 'array-contains', 'cliente')
        .where('migrado', '!=', true)
        .orderBy('migrado')
        .limit(LIMIT)
        .get();
      return snapshot.docs;
    } catch (e) {
      logError('QUERY', { note: 'Fallo query con .limit(). Se traerán todos y se aplicará tope en memoria.' }, e);
      snapshot = await db
        .collection('usuarios')
        .where('roles', 'array-contains', 'cliente')
        .where('migrado', '!=', true)
        .get();
      return snapshot.docs.slice(0, LIMIT);
    }
  } catch (e) {
    logError('TARGETS', { note: 'Error resolviendo targets' }, e);
    return [];
  }
}

function extractUbicacion(idStrRaw, nitRaw) {
  const idStr = String(idStrRaw || '').trim();
  const nit = String(nitRaw || '').trim();

  if (!idStr) return '';
  const compact = idStr.replace(/\s+/g, ' ');

  let rest = compact;
  let joinedNoSep = false;

  if (nit && rest.startsWith(nit)) {
    const nextChar = rest.charAt(nit.length) || '';
    rest = rest.slice(nit.length);

    if (nextChar && !/[\s-]/.test(nextChar)) {
      joinedNoSep = true;
    }

    rest = rest.replace(/^[\s-]+/, '');
  } else {
    rest = rest.trim();
  }

  const tokens = rest.split(' ').filter(Boolean);
  if (tokens.length > 1) {
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i];
      if (/^\d+-\d+-?$/.test(t)) {
        return t.replace(/-+$/, '');
      }
    }
    const idx = rest.indexOf('-');
    return idx >= 0 ? rest.slice(idx + 1).replace(/[^\d]+$/, '') : rest.replace(/[^\d]+$/, '');
  }

  rest = tokens.length === 1 ? tokens[0] : rest;
  if (!rest) return '';

  rest = rest.replace(/[^\d]+$/, '');

  if (joinedNoSep && /^\d+-\d+$/.test(rest)) {
    const p = rest.indexOf('-');
    return p >= 0 ? rest.slice(p + 1) : rest;
  }

  if (rest.startsWith('-')) {
    rest = rest.slice(1);
  }

  if (/^\d+-\d+$/.test(rest)) {
    return rest;
  }

  const p = rest.indexOf('-');
  if (p >= 0) return rest.slice(p + 1).replace(/[^\d]+$/, '');

  return rest;
}


// ====================== MAIN ======================
async function main() {
  const connection = await mysql.createConnection(MYSQL_CONFIG);
  console.log('✅ Conectado a MySQL');

  // ---- Resolver clientes objetivo ----
  const docs = await resolveTargetClients();
  console.log(`▶️ Se migrarán ${docs.length} cliente(s).`);

  for (const doc of docs) {
    const clienteId = doc.id;
    const cliente = typeof doc.data === 'function' ? doc.data() : doc.data;
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
      detalle: '',
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

      // 2) Procesos del afiliado (ejemplo: activos esp_id = 1)
      const [procesos] = await connection.execute(
        'SELECT * FROM scc_proceso WHERE esp_id = 1 AND usr_afiliado_id = ?',
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
              const ubicacion = extractUbicacion(usuario.usr_identificacion, nit);

              // Teléfonos (array)
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

              // 5) Título (un solo registro) → valor y fecha
              const [tituloRows] = await connection.execute(
                `SELECT tit_valor_de_entrega, tit_fecha_de_expedicion
                    FROM scc_titulo
                    WHERE pro_id = ?
                ORDER BY tit_fecha_de_expedicion ASC
                    LIMIT 1`,
                [proceso.pro_id]
              );

              // Un solo título (o null si no hay)
              const titulo = tituloRows?.[0] || null;

              // Valor de la deuda: SOLO el del primer título
              const deudaTitulo = titulo ? Number(titulo.tit_valor_de_entrega || 0) : 0;

              // === deudaTotal disponible para reporte y estados
              const deudaTotal = deudaTitulo;

              // Fecha del título → "YYYY-MM"
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

              // 7) Seguimientos + tipificación (una sola vez, sirve para % y para guardar seguimientos)
              const [seguimientos] = await connection.execute(
                'SELECT obp_observacion, tip_id, obp_fecha_observacion FROM scc_observacion_proceso WHERE pro_id = ?',
                [proceso.pro_id]
              );

              const tipificacion = computeTipificacion(seguimientos);
              const porcentajeHonorariosEstados = (tipificacion === 'Demanda') ? 20 : 15;

              if (tipificacion) {
                try {
                  await deudorRef.update({ tipificacion });
                } catch (e) {
                  logError('DEUDOR', { clienteId, nit, pro_id: proceso.pro_id, deudorIdFS: deudorRef.id, note: 'update tipificacion' }, e);
                }
              }

              // Declarar antes de cualquier incremento
              let mesesCreados = 0;

              // 👉 SOLO-DEUDA: si NO hay abonos y SÍ hay deuda del título,
              // crea un estado mensual con % 15 en el mes del título (tal como acordado).
              if (porMes.size === 0 && deudaTitulo > 0) {
                const porcentajeHonorarios = 15; // prejurídico por defecto para solo-deuda
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
                  await deudorRef
                    .collection("estadosMensuales")
                    .doc(mesSoloDeuda)
                    .set(estadoSoloDeuda, { merge: true });
                  mesesCreados += 1;
                  clienteRow.totalEstadosMensuales += 1;
                } catch (e) {
                  logError(
                    "ESTADOS",
                    { clienteId, nit, pro_id: proceso.pro_id, deudorIdFS: deudorRef.id, mes: mesSoloDeuda },
                    e
                  );
                }
              }

              // 👉 Estados por cada mes con abonos (deuda + recaudo) — aquí entra el % por tipificación
              for (const [mes, lista] of porMes.entries()) {
                const sumaRecaudo = (lista || []).reduce((s, it) => s + Number(it.abn_monto || 0), 0);

                // 1er registro como fuente de recibo/observación
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
                  mes,                                   // "YYYY-MM"
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

              // 8) Guardar seguimientos (reutilizando la consulta anterior; no se duplica)
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
                    tipoSeguimiento: 'otro',
                    archivoUrl: '',
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
                tipificacion,
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
      resumenClientes.push({
        ...clienteRow,
        status: 'ERROR',
        detalle: e?.message || 'Error procesando cliente',
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
