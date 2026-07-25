/* eslint-disable no-console */
/**
 * Migración: campos de demanda planos del deudor  →  subcolección `demandas`.
 *
 * Por cada deudor que tenga datos de demanda (radicado/juzgado/demandados no vacíos,
 * o subcolección seguimientoDemanda con docs, o tipificación Demanda*) crea UNA demanda en:
 *   clientes/{clienteId}/deudores/{deudorId}/demandas/{demandaId}
 *
 * - Normaliza demandados legacy (string | array) → [{ nombre, numeroDocumento, notificaciones: [] }]
 * - Deriva estado: "Demanda/Terminado" → "terminada", resto → "activa"
 * - Copia procesoJudicial, fechaUltimaRevision, observaciones, demandaSustituto
 * - Denormaliza clienteId/deudorId/deudorNombre/ubicacion
 * - Copia los docs de seguimientoDemanda del deudor a la demanda CONSERVANDO sus ids
 * - Idempotente: marca deudor.demandaMigradaId; si ya existe, se salta
 * - NO borra los campos legacy del deudor (rollback barato; limpieza posterior aparte)
 *
 * Uso:
 *   node .\migrar-demandas.js            → DRY-RUN (no escribe nada, solo reporta)
 *   node .\migrar-demandas.js --commit   → ejecuta la migración real
 *   node .\migrar-demandas.js --commit --cliente=<clienteId>   → solo un cliente (prueba)
 */

const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ---- Flags ----
const ARGS = process.argv.slice(2);
const COMMIT = ARGS.includes("--commit");
const CLIENTE_FILTRO =
  (ARGS.find((a) => a.startsWith("--cliente=")) || "").split("=")[1] || null;

// ---- Constantes de negocio ----
const TIPIFICACIONES_DEMANDA = new Set([
  "Demanda",
  "Demanda/Acuerdo",
  "Demanda/Terminado",
  "Demanda/Insolvencia",
]);

const toStr = (v) => (v === undefined || v === null ? "" : String(v).trim());

// Normaliza demandados legacy → array de {nombre, numeroDocumento, notificaciones:[]}
function normalizeDemandados(raw) {
  if (!raw) return [];
  if (typeof raw === "string") {
    const s = raw.trim();
    return s ? [{ nombre: s, numeroDocumento: "", notificaciones: [] }] : [];
  }
  if (Array.isArray(raw)) {
    return raw
      .filter(Boolean)
      .map((item) => ({
        nombre: toStr(item.nombre),
        numeroDocumento: toStr(item.numeroDocumento),
        notificaciones: [],
      }))
      .filter((d) => d.nombre);
  }
  return [];
}

function estadoDesdeTipificacion(tipificacion) {
  return tipificacion === "Demanda/Terminado" ? "terminada" : "activa";
}

// ¿El deudor tiene información de demanda que amerite migrarse?
function tieneDatosDemanda(data, cantSeguimientos) {
  const demandados = normalizeDemandados(data.demandados);
  const tieneCampos =
    demandados.length > 0 ||
    toStr(data.numeroRadicado) ||
    toStr(data.juzgado) ||
    toStr(data.localidad);
  const esTipDemanda = TIPIFICACIONES_DEMANDA.has(data.tipificacion);
  return !!(tieneCampos || esTipDemanda || cantSeguimientos > 0);
}

async function migrarDeudor(clienteId, deudorDoc, stats) {
  const data = deudorDoc.data();
  const deudorId = deudorDoc.id;
  const deudorRef = deudorDoc.ref;

  // Idempotencia
  if (data.demandaMigradaId) {
    stats.saltados++;
    return;
  }

  // Traer subcolección de seguimiento del deudor
  const segSnap = await db
    .collection(`clientes/${clienteId}/deudores/${deudorId}/seguimientoDemanda`)
    .get();

  if (!tieneDatosDemanda(data, segSnap.size)) {
    stats.sinDemanda++;
    return;
  }

  const demandados = normalizeDemandados(data.demandados);
  const estado = estadoDesdeTipificacion(data.tipificacion);

  const nuevaDemanda = {
    numeroRadicado: toStr(data.numeroRadicado),
    juzgado: toStr(data.juzgado),
    localidad: toStr(data.localidad),
    demandaSustituto: data.demandaSustituto === true,
    estado,
    demandados,
    etiquetas: [],
    proximaAccionFecha: null,
    observacionesDemanda: toStr(data.observacionesDemanda),
    observacionesDemandaCliente: toStr(data.observacionesDemandaCliente),
    ...(data.observacionesDemandaClienteFecha
      ? { observacionesDemandaClienteFecha: data.observacionesDemandaClienteFecha }
      : {}),
    fechaUltimaRevision: data.fechaUltimaRevision ?? null,
    fechaCreacion: data.fechaCreacion ?? admin.firestore.FieldValue.serverTimestamp(),
    fechaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
    ...(data.procesoJudicial ? { procesoJudicial: data.procesoJudicial } : {}),
    // Denormalizados
    clienteId,
    deudorId,
    deudorNombre: toStr(data.nombre),
    ubicacion: toStr(data.ubicacion),
  };

  console.log(
    `  → ${toStr(data.nombre) || deudorId} | rad='${nuevaDemanda.numeroRadicado}' | ` +
      `estado=${estado} | demandados=${demandados.length} | seguimientos=${segSnap.size}`
  );

  if (!COMMIT) {
    stats.migrados++;
    return;
  }

  // Crear demanda
  const demandaRef = db
    .collection(`clientes/${clienteId}/deudores/${deudorId}/demandas`)
    .doc();
  await demandaRef.set(nuevaDemanda);

  // Copiar seguimientos conservando ids (en lotes)
  let batch = db.batch();
  let ops = 0;
  for (const s of segSnap.docs) {
    const destino = demandaRef.collection("seguimientoDemanda").doc(s.id);
    batch.set(destino, s.data());
    ops++;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  // Marcar deudor como migrado (idempotencia)
  await deudorRef.update({ demandaMigradaId: demandaRef.id });

  stats.migrados++;
  stats.seguimientosCopiados += segSnap.size;
}

(async function main() {
  console.log(
    `🚀 Migración de demandas — modo: ${COMMIT ? "COMMIT (escribe)" : "DRY-RUN (solo lee)"}` +
      (CLIENTE_FILTRO ? ` — cliente único: ${CLIENTE_FILTRO}` : "")
  );

  const clientesSnap = CLIENTE_FILTRO
    ? await db
        .collection("clientes")
        .where(admin.firestore.FieldPath.documentId(), "==", CLIENTE_FILTRO)
        .get()
    : await db.collection("clientes").get();

  console.log(`📋 Clientes a revisar: ${clientesSnap.size}\n`);

  const stats = {
    migrados: 0,
    saltados: 0,
    sinDemanda: 0,
    seguimientosCopiados: 0,
    errores: 0,
  };

  for (const clienteDoc of clientesSnap.docs) {
    const clienteId = clienteDoc.id;
    const nombreCliente = clienteDoc.data().nombre || clienteId;

    const deudoresSnap = await db
      .collection(`clientes/${clienteId}/deudores`)
      .get();
    if (deudoresSnap.empty) continue;

    console.log(`\n[${nombreCliente}] — ${deudoresSnap.size} deudores`);

    for (const deudorDoc of deudoresSnap.docs) {
      try {
        await migrarDeudor(clienteId, deudorDoc, stats);
      } catch (err) {
        stats.errores++;
        console.error(
          `  ❌ ${deudorDoc.data().nombre || deudorDoc.id} → ${err.message || err}`
        );
      }
    }
  }

  console.log("\n════════════════════════════════════════");
  console.log(`  Demandas ${COMMIT ? "creadas" : "que se crearían"} : ${stats.migrados}`);
  console.log(`  Seguimientos copiados          : ${stats.seguimientosCopiados}`);
  console.log(`  Deudores ya migrados (saltados): ${stats.saltados}`);
  console.log(`  Deudores sin demanda           : ${stats.sinDemanda}`);
  if (stats.errores > 0) console.log(`  Errores                        : ${stats.errores}`);
  console.log("════════════════════════════════════════");
  if (!COMMIT) {
    console.log("ℹ️  DRY-RUN: no se escribió nada. Repite con --commit para ejecutar.");
  } else {
    console.log("🎉 Migración completada.");
  }
})().catch((e) => {
  console.error("❌ Error no controlado:", e);
  process.exit(1);
});
