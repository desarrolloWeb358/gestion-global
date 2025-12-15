// migrar-nomos-mysql-por-ubicaciones.js
/* eslint-disable no-console */
const admin = require("firebase-admin");
const mysql = require("mysql2/promise");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const serviceAccount = require("./serviceAccountKey.json");

// ================== CONFIG ==================
const INPUT_FILE = path.resolve(process.cwd(), "migracion_ubicaciones.xlsx");
const OUT_FILE = path.resolve(process.cwd(), "reporte_migracion_ubicaciones.xlsx");

// Si quieres quemar el NIT en código, ponlo aquí y deja el Excel solo con ubicaciones.
// const HARDCODED_NIT = "900123456";
const HARDCODED_NIT = null;

// ====== FIREBASE ======
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ====== MYSQL ======
const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASS || "gestion_2025",
  database: process.env.MYSQL_DB || "gl0vg3t1_n0mxy24",
};

// ====== TIPIFICACION ======
const TIP_IDS_DEMANDA = new Set([39, 47, 85]);

function computeTipificacion(rows) {
  if (!rows || rows.length === 0) return "Gestionando";
  const ids = rows
    .map((r) => (r.tip_id === null ? null : Number(r.tip_id)))
    .filter((v) => v === null || !Number.isNaN(v));

  const hasDemanda = ids.some((v) => v === null || TIP_IDS_DEMANDA.has(v));
  if (hasDemanda) return "Demanda";
  const hasAcuerdo = ids.some((v) => v === 2);
  if (hasAcuerdo) return "Acuerdo";
  const allGestionando = ids.length > 0 && ids.every((v) => v === 1);
  if (allGestionando) return "Gestionando";
  return "Gestionando";
}

function loadOrCreateWorkbook(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      return XLSX.readFile(filePath);
    } catch (e) {
      console.warn(`⚠️ No se pudo leer ${filePath}. Se creará uno nuevo.`, e?.message || e);
    }
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

// ====== REPORTE ======
const resumen = [];
const detalleMigrados = [];
const detalleSaltados = [];
const errores = [];

function logError(scope, info, err) {
  errores.push({
    timestamp: new Date().toISOString(),
    scope,
    ...info,
    message: err?.message || String(err),
  });
  console.warn(`❌ [${scope}]`, info, err?.message || err);
}

// ====== FIRESTORE HELPERS ======
async function fetchClientByNit(nit) {
  const q = await db
    .collection("usuarios")
    .where("roles", "array-contains", "cliente")
    .where("numeroDocumento", "==", nit)
    .limit(1)
    .get();

  if (q.empty) return null;
  const doc = q.docs[0];
  return { id: doc.id, data: doc.data() };
}

async function fetchEjecutivosCliente(clienteId) {
  try {
    const snap = await db.collection("clientes").doc(clienteId).get();
    if (!snap.exists) return { ejecutivoPrejuridicoId: null, ejecutivoJuridicoId: null };
    const data = snap.data() || {};
    return {
      ejecutivoPrejuridicoId: data.ejecutivoPrejuridicoId || null,
      ejecutivoJuridicoId: data.ejecutivoJuridicoId || null,
    };
  } catch (e) {
    logError("CLIENTE_EJECUTIVOS", { clienteId }, e);
    return { ejecutivoPrejuridicoId: null, ejecutivoJuridicoId: null };
  }
}

function extractUbicacion(idStrRaw, nitRaw) {
  const idStr = String(idStrRaw || "").trim();
  const nit = String(nitRaw || "").trim();
  if (!idStr || !nit) return idStr;

  let rest = idStr.startsWith(nit) ? idStr.slice(nit.length).replace(/^[-\s]+/, "") : idStr;
  return rest.trim();
}

// Normaliza ubicaciones para comparar (evita líos por mayúsculas/espacios)
function normUbicacion(u) {
  return String(u || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

// Opcional: evita duplicar si ya existe un deudor con esa ubicacion en Firestore
async function existsDeudorByUbicacion(clienteId, ubicacionNorm) {
  try {
    const q = await db
      .collection("clientes")
      .doc(clienteId)
      .collection("deudores")
      .where("ubicacionNorm", "==", ubicacionNorm)
      .limit(1)
      .get();
    return !q.empty;
  } catch (e) {
    // Si falla la validación, no bloquees la migración
    logError("DEDUP", { clienteId, ubicacionNorm, note: "Error consultando duplicados" }, e);
    return false;
  }
}

// ====== LECTURA EXCEL (1 NIT + lista de ubicaciones) ======
function readExcelTargets(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontró el archivo ${path.basename(filePath)} en ${path.dirname(filePath)}`);
  }
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const nitKeys = ["nit", "NIT", "numeroDocumento", "documento"];
  const ubicKeys = ["ubicacion", "Ubicacion", "ubicación", "Ubicación", "unidad", "inmueble"];

  let nit = HARDCODED_NIT ? String(HARDCODED_NIT).trim() : "";
  const ubicaciones = [];

  for (const r of rows) {
    if (!nit) {
      for (const k of nitKeys) {
        if (r[k]) {
          nit = String(r[k]).trim();
          break;
        }
      }
    }
    for (const k of ubicKeys) {
      if (r[k]) {
        ubicaciones.push(String(r[k]).trim());
        break;
      }
    }
  }

  if (!nit) {
    throw new Error(
      `No se pudo resolver el NIT. Ponlo en el Excel (columna nit/NIT/numeroDocumento/documento) o quémalo en HARDCODED_NIT.`
    );
  }

  const clean = Array.from(
    new Set(
      ubicaciones
        .map((u) => u.trim())
        .filter(Boolean)
        .map(normUbicacion)
    )
  );

  if (clean.length === 0) {
    throw new Error(`El Excel no tiene ubicaciones válidas (columna ubicacion/ubicación/unidad/inmueble).`);
  }

  console.log(`🎯 Target: NIT=${nit} | Ubicaciones=${clean.length}`);
  return { nit, ubicacionesSet: new Set(clean) };
}

// ====================== MAIN ======================
async function main() {
  const { nit, ubicacionesSet } = readExcelTargets(INPUT_FILE);

  const clienteDoc = await fetchClientByNit(nit);
  if (!clienteDoc) {
    throw new Error(`No se encontró cliente en Firestore/usuarios con rol "cliente" y numeroDocumento == ${nit}`);
  }

  const clienteId = clienteDoc.id;
  const clienteNombre = clienteDoc.data?.nombre || "";
  console.log(`✅ Cliente Firestore: ${clienteNombre} (clienteId=${clienteId})`);

  const { ejecutivoPrejuridicoId, ejecutivoJuridicoId } = await fetchEjecutivosCliente(clienteId);

  const connection = await mysql.createConnection(MYSQL_CONFIG);
  console.log("✅ Conectado a MySQL");

  const rowResumen = {
    timestamp: new Date().toISOString(),
    clienteId,
    clienteNombre,
    nit,
    ubicacionesObjetivo: ubicacionesSet.size,
    ubicacionesMigradas: 0,
    deudoresCreados: 0,
    estadosMensualesCreados: 0,
    seguimientosCreados: 0,
    status: "PENDIENTE",
    detalle: "",
  };

  try {
    // 1) Afiliado (cliente) en MySQL
    const [clientesSQL] = await connection.execute(
      "SELECT usr_id FROM scc_usuarios WHERE usr_identificacion = ?",
      [nit]
    );

    if (!clientesSQL || clientesSQL.length === 0) {
      rowResumen.status = "NO ESTA EN NOMOS";
      rowResumen.detalle = "No existe scc_usuarios.usr_identificacion == NIT";
      resumen.push(rowResumen);
      return;
    }

    const afiliadoId = clientesSQL[0].usr_id;

    // 2) Procesos activos del afiliado
    const [procesos] = await connection.execute(
      "SELECT * FROM scc_proceso WHERE esp_id = 1 AND usr_afiliado_id = ?",
      [afiliadoId]
    );

    if (!procesos || procesos.length === 0) {
      rowResumen.status = "SIN PROCESOS";
      rowResumen.detalle = "No hay procesos esp_id=1";
      resumen.push(rowResumen);
      return;
    }

    // Mapa para saber qué ubicaciones objetivo sí se encontraron/migraron
    const ubicacionesEncontradas = new Set();

    for (const proceso of procesos) {
      try {
        // 3) Demandados del proceso
        const [demandados] = await connection.execute(
          "SELECT usr_demandado_id FROM scc_proceso_has_usuarios WHERE pro_id = ?",
          [proceso.pro_id]
        );

        for (const row of demandados || []) {
          const demandadoId = row.usr_demandado_id;

          try {
            const [usuarios] = await connection.execute(
              "SELECT usr_nombre, usr_identificacion FROM scc_usuarios WHERE usr_id = ?",
              [demandadoId]
            );

            if (!usuarios || usuarios.length === 0) {
              logError("DEUDOR", { clienteId, nit, pro_id: proceso.pro_id, demandadoId }, new Error("Demandado sin registro en scc_usuarios"));
              continue;
            }

            const usuario = usuarios[0];
            const ubicacion = extractUbicacion(usuario.usr_identificacion, nit);
            const ubicacionNorm = normUbicacion(ubicacion);

            // ✅ FILTRO PRINCIPAL: solo si está en el Excel
            if (!ubicacionesSet.has(ubicacionNorm)) {
              detalleSaltados.push({
                nit,
                clienteId,
                pro_id: proceso.pro_id,
                demandadoId,
                deudorNombre: usuario.usr_nombre || "",
                ubicacion,
                ubicacionNorm,
                motivo: "Ubicación no está en lista",
              });
              continue;
            }

            ubicacionesEncontradas.add(ubicacionNorm);

            // ✅ DEDUP opcional: evita crear duplicado si ya existe por ubicacionNorm
            const yaExiste = await existsDeudorByUbicacion(clienteId, ubicacionNorm);
            if (yaExiste) {
              detalleSaltados.push({
                nit,
                clienteId,
                pro_id: proceso.pro_id,
                demandadoId,
                deudorNombre: usuario.usr_nombre || "",
                ubicacion,
                ubicacionNorm,
                motivo: "Ya existe en Firestore (ubicacionNorm)",
              });
              rowResumen.ubicacionesMigradas += 1; // encontrada, pero no creada
              continue;
            }

            // Teléfonos
            const [telefonosRows] = await connection.execute(
              "SELECT tlu_numero FROM scc_tel_usuarios WHERE usr_id = ?",
              [demandadoId]
            );
            const telefonos = (telefonosRows || []).map((r) => r.tlu_numero).filter(Boolean);

            // Dirección (primera)
            const [direccionRows] = await connection.execute(
              "SELECT diru_direccion FROM scc_dir_usuarios WHERE usr_id = ? LIMIT 1",
              [demandadoId]
            );
            const direccion = direccionRows?.[0]?.diru_direccion || "";

            // 4) Crear deudor en Firestore (IGUAL, solo agregué ubicacionNorm para dedup)
            const deudorData = {
              nombre: usuario.usr_nombre || "",
              ubicacion,
              ubicacionNorm,
              direccion,
              telefonos,
              correos: [],
              estado: "",
              tipificacion: "",
              fechaCreacion: admin.firestore.FieldValue.serverTimestamp(),
              ...(proceso.pro_numero ? { numeroProceso: proceso.pro_numero } : {}),
              ...(proceso.pro_ano ? { anoProceso: proceso.pro_ano } : {}),
              ...(proceso.juz_id ? { juzgadoId: proceso.juz_id } : {}),
            };

            const deudorRef = await db
              .collection("clientes")
              .doc(clienteId)
              .collection("deudores")
              .add(deudorData);

            rowResumen.deudoresCreados += 1;
            rowResumen.ubicacionesMigradas += 1;

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
              "SELECT abn_monto, abn_fecha, abn_observaciones, abn_comprobante_num FROM scc_abono WHERE pro_id = ?",
              [proceso.pro_id]
            );

            const porMes = new Map();
            for (const a of abonos || []) {
              if (!a.abn_fecha) continue;
              const mes = toMesYYYYMM(a.abn_fecha);
              if (!mes) continue;
              if (!porMes.has(mes)) porMes.set(mes, []);
              porMes.get(mes).push(a);
            }

            // Seguimientos + tipificación
            const [seguimientos] = await connection.execute(
              "SELECT obp_observacion, tip_id, obp_fecha_observacion FROM scc_observacion_proceso WHERE pro_id = ?",
              [proceso.pro_id]
            );

            const tipificacion = computeTipificacion(seguimientos);
            const porcentajeHonorariosEstados = tipificacion === "Demanda" ? 20 : 15;

            if (tipificacion) {
              try {
                await deudorRef.update({ tipificacion });
              } catch (e) {
                logError("DEUDOR", { clienteId, nit, pro_id: proceso.pro_id, deudorIdFS: deudorRef.id, note: "update tipificacion" }, e);
              }
            }

            let mesesCreados = 0;

            // SOLO-DEUDA (sin abonos) → 15% en mes del título (igual a tu script actual)
            if (porMes.size === 0 && deudaTitulo > 0) {
              const porcentajeHonorarios = 15;
              const honorariosDeuda = Math.round((deudaTitulo * porcentajeHonorarios) / 100);
              const mesSoloDeuda =
                mesDeuda ||
                `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

              const estadoSoloDeuda = {
                clienteUID: clienteId,
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
                rowResumen.estadosMensualesCreados += 1;
              } catch (e) {
                logError("ESTADOS", { clienteId, nit, pro_id: proceso.pro_id, deudorIdFS: deudorRef.id, mes: mesSoloDeuda }, e);
              }
            }

            // Estados por cada mes con abonos
            for (const [mes, lista] of porMes.entries()) {
              const sumaRecaudo = (lista || []).reduce((s, it) => s + Number(it.abn_monto || 0), 0);

              let recibo = "";
              let observaciones = "";
              if (lista.length > 0) {
                recibo = lista[0].abn_comprobante_num ? String(lista[0].abn_comprobante_num) : "";
                observaciones = lista[0].abn_observaciones || "";
              }

              const porcentajeHonorarios = porcentajeHonorariosEstados;
              const honorariosDeuda = Math.round(((Number(deudaTotal) || 0) * porcentajeHonorarios) / 100);

              const estadoDoc = {
                clienteUID: clienteId,
                mes,
                deuda: Number(deudaTotal) || 0,
                recaudo: Number(sumaRecaudo) || 0,
                porcentajeHonorarios,
                honorariosDeuda,
                honorariosRecaudo: 0,
                ...(recibo ? { recibo } : {}),
                ...(observaciones ? { observaciones } : {}),
              };

              try {
                await deudorRef.collection("estadosMensuales").doc(mes).set(estadoDoc, { merge: true });
                mesesCreados += 1;
                rowResumen.estadosMensualesCreados += 1;
              } catch (e) {
                logError("ESTADOS", { clienteId, nit, pro_id: proceso.pro_id, deudorIdFS: deudorRef.id, mes }, e);
              }
            }

            // Seguimientos
            let segCount = 0;
            for (const s of seguimientos || []) {
              try {
                const desc = s.obp_observacion?.trim();
                const fechaRaw = s.obp_fecha_observacion;
                if (!desc || !fechaRaw) continue;

                const tipNum = s.tip_id === null ? null : Number(s.tip_id);
                const esJuridico = tipNum === null || TIP_IDS_DEMANDA.has(tipNum);
                const collectionName = esJuridico ? "seguimientoJuridico" : "seguimiento";
                const ejecutivoID = esJuridico ? ejecutivoJuridicoId : ejecutivoPrejuridicoId;

                const seguimientoDoc = {
                  descripcion: desc,
                  fecha: admin.firestore.Timestamp.fromDate(new Date(fechaRaw)),
                  fechaCreacion: admin.firestore.Timestamp.fromDate(new Date(fechaRaw)),
                  tipoSeguimiento: "Otro",
                  archivoUrl: "",
                  clienteUID: clienteId,
                  ejecutivoUID: ejecutivoID || "",
                };

                await deudorRef.collection(collectionName).add(seguimientoDoc);
                segCount += 1;
                rowResumen.seguimientosCreados += 1;
              } catch (e) {
                logError("SEGUIMIENTOS", { clienteId, nit, pro_id: proceso.pro_id, deudorIdFS: deudorRef.id }, e);
              }
            }

            detalleMigrados.push({
              timestamp: new Date().toISOString(),
              nit,
              clienteId,
              deudorId: deudorRef.id,
              deudorNombre: deudorData.nombre,
              ubicacion: deudorData.ubicacion,
              ubicacionNorm: deudorData.ubicacionNorm,
              pro_id: proceso.pro_id,
              numeroProceso: proceso.pro_numero || "",
              anoProceso: proceso.pro_ano || "",
              juzgadoId: proceso.juz_id || "",
              deudaTotal,
              mesesCreados,
              seguimientosCreados: segCount,
              tipificacion,
            });

            console.log(`✅ Migrado por ubicación: ${deudorData.ubicacion} -> ${deudorData.nombre} (${deudorRef.id})`);
          } catch (e) {
            logError("DEUDOR", { clienteId, nit, pro_id: proceso.pro_id, demandadoId }, e);
          }
        }
      } catch (e) {
        logError("PROCESO", { clienteId, nit, pro_id: proceso?.pro_id }, e);
      }
    }

    // Ubicaciones objetivo que NO se encontraron en MySQL
    const faltantes = [];
    for (const u of ubicacionesSet) {
      if (!ubicacionesEncontradas.has(u)) faltantes.push(u);
    }

    rowResumen.status = rowResumen.deudoresCreados > 0 ? "OK" : "NO MIGRO NADA";
    rowResumen.detalle = faltantes.length ? `Faltantes (no encontrados en MySQL): ${faltantes.length}` : "";

    // (opcional) Marca migración selectiva
    try {
      await db.collection("clientes").doc(clienteId).set(
        {
          migrado_selectivo: true,
          migrado_selectivo_fecha: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log(`🟢 Marcado migrado_selectivo=true en clientes/${clienteId}`);
    } catch (e) {
      logError("FINAL", { clienteId, note: "Marcando migrado_selectivo" }, e);
    }

    // Log faltantes a hoja "Faltantes"
    for (const u of faltantes) {
      detalleSaltados.push({
        nit,
        clienteId,
        ubicacionNorm: u,
        motivo: "Ubicación objetivo NO encontrada en procesos/demandados",
      });
    }

    resumen.push(rowResumen);
  } finally {
    await connection.end();
  }

  console.log("🚀 Finalizado. Generando reporte Excel...");

  try {
    const wb = loadOrCreateWorkbook(OUT_FILE);
    appendRowsToSheet(wb, "Resumen", resumen);
    appendRowsToSheet(wb, "Migrados", detalleMigrados);
    appendRowsToSheet(wb, "Saltados", detalleSaltados);
    appendRowsToSheet(wb, "Errores", errores);
    XLSX.writeFile(wb, OUT_FILE);
    console.log(`📄 Reporte Excel actualizado: ${OUT_FILE}`);
  } catch (e) {
    logError("FINAL", { note: "Generando/Actualizando Excel" }, e);
  }

  console.log("✅ Proceso completado.");
}

main().catch((e) => {
  logError("FINAL", { note: "main() unhandled" }, e);
  process.exit(1);
});
