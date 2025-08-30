// migrar-deudores-estados-mensuales.js
const admin = require('firebase-admin');
const mysql = require('mysql2/promise');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// --- NUEVO: Helper para calcular tipificación ---
const TIP_IDS_DEMANDA = new Set([39, 47, 85]);
function computeTipificacion(rows) {
  if (!rows || rows.length === 0) return '';

  // Mapear a números o null (si viene null)
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

  return 'Gestionando'; // Por defecto si no hay tipificación clara
}

const main = async () => {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'gestion_2025',
    database: 'gestion_antigua',
  });

  console.log('✅ Conectado a MySQL');

  // Clientes aún no migrados
  const snapshot = await db.collection('usuarios')
    .where('roles', 'array-contains', 'cliente')
    .where('migrado', '!=', true)
    .get();

  for (const doc of snapshot.docs) {
    const clienteId = doc.id;
    const cliente = doc.data();
    const nit = cliente.numeroDocumento;
    if (!nit) continue;

    // 1) Cliente (afiliado) en MySQL
    const [clientesSQL] = await connection.execute(
      'SELECT usr_id FROM scc_usuarios WHERE usr_identificacion = ?',
      [nit]
    );
    if (clientesSQL.length === 0) {
      console.warn(`❌ Cliente no encontrado en MySQL: ${nit}`);
      continue;
    }

    const afiliadoId = clientesSQL[0].usr_id;

    // 2) Procesos del afiliado
    const [procesos] = await connection.execute(
      'SELECT * FROM scc_proceso WHERE usr_afiliado_id = ?',
      [afiliadoId]
    );

    for (const proceso of procesos) {
      // 3) Deudores del proceso
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
        const partes = (usuario.usr_identificacion || '').split('-');
        const ubicacion = partes[1] || '';

        // Teléfonos (array)
        const [telefonosRows] = await connection.execute(
          'SELECT tlu_numero FROM scc_tel_usuarios WHERE usr_id = ?',
          [demandadoId]
        );
        const telefonos = telefonosRows.map(r => r.tlu_numero).filter(Boolean);

        // Dirección (primera)
        const [direccionRows] = await connection.execute(
          'SELECT diru_direccion FROM scc_dir_usuarios WHERE usr_id = ? LIMIT 1',
          [demandadoId]
        );
        const direccion = (direccionRows[0] && direccionRows[0].diru_direccion) ? direccionRows[0].diru_direccion : '';

        // 4) Crear deudor (sin deudaTotal); tipificacion se calculará luego)
        const deudorData = {
          nombre: usuario.usr_nombre,
          ubicacion,
          direccion,
          telefonos,
          correos: [],
          estado: '',
          tipificacion: '', // <- se actualizará después según seguimientos
          fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
          ...(proceso.pro_numero ? { numeroProceso: proceso.pro_numero } : {}),
          ...(proceso.pro_ano ? { anoProceso: proceso.pro_ano } : {}),
          ...(proceso.juz_id ? { juzgadoId: proceso.juz_id } : {}),
        };

        const deudorRef = await db.collection('clientes').doc(clienteId).collection('deudores').add(deudorData);
        console.log(`✅ Deudor migrado: ${deudorData.nombre} (${deudorRef.id})`);

        // 5) Calcular deuda total (suma de títulos) — se guardará en cada mes
        const [titulos] = await connection.execute(
          'SELECT tit_valor_de_entrega FROM scc_titulo WHERE pro_id = ?',
          [proceso.pro_id]
        );
        const deudaTotal = titulos.reduce((sum, t) => sum + (t.tit_valor_de_entrega || 0), 0);

        // 6) Traer abonos y agrupar por mes (AAAA-MM)
        const [abonos] = await connection.execute(
          'SELECT abn_monto, abn_fecha, abn_observaciones, abn_comprobante_num FROM scc_abono WHERE pro_id = ?',
          [proceso.pro_id]
        );

        // Agrupar: { '2025-08': [abono1, abono2, ...], ... }
        const porMes = new Map();
        for (const a of abonos) {
          if (!a.abn_fecha) continue;
          const d = new Date(a.abn_fecha);
          const mes = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
          if (!porMes.has(mes)) porMes.set(mes, []);
          porMes.get(mes).push(a);
        }

        // 7) Escribir/actualizar estadosMensuales (docId = mes)
        for (const [mes, lista] of porMes.entries()) {
          const sumaRecaudo = lista.reduce((s, it) => s + Number(it.abn_monto || 0), 0);

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

          await deudorRef.collection('estadosMensuales').doc(mes).set(estadoDoc, { merge: true });
          console.log(`📆 Estado mensual ${mes} → deuda=${estadoDoc.deuda} / recaudo=${estadoDoc.recaudo}`);
        }

        // 8) Seguimientos: obtener primero para calcular tipificación
        const [seguimientos] = await connection.execute(
          'SELECT obp_observacion, tip_id, obp_fecha_observacion FROM scc_observacion_proceso WHERE pro_id = ?',
          [proceso.pro_id]
        );

        // --- NUEVO: calcular tipificación y actualizar deudor ---
        const tipificacion = computeTipificacion(seguimientos);
        if (tipificacion) {
          await deudorRef.update({ tipificacion });
          console.log(`🏷️ Tipificación asignada: ${tipificacion}`);
        }

        // Guardar cada seguimiento en la colección correcta:
        // - si tip_id ∈ {39, 47, 85} => 'seguimientoJuridico' (incluye null)
        // - en otro caso  => 'seguimiento'
        for (const s of seguimientos) {
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
        }
      }
    }

    await db.collection('usuarios').doc(clienteId).update({ migrado: true });
    console.log(`🟢 Cliente ${cliente.nombre} marcado como migrado`);
  }

  await connection.end();
  console.log('🚀 Migración completa');
};

main();
