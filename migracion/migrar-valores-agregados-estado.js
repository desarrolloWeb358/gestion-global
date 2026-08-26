/* eslint-disable no-console */
/**
 * Migración: `completado` (booleano ambiguo) → `estado` + `esperaRespuestaDe`.
 *
 * Contexto: hoy `completado` NO significa "el trámite se resolvió". Lo escribe
 * crearMensajeConversacionValorAgregado en CADA mensaje y significa literalmente
 * "el último que escribió no fue el cliente". Por eso NO se migra desde ese campo:
 * se deriva desde la conversación, que es el dato real.
 *
 * Derivación de `esperaRespuestaDe` (determinista):
 *   último mensaje del cliente  → "juridica"
 *   último mensaje interno      → "cliente"
 *   sin mensajes                → "juridica"
 *
 * Derivación de `estado` (heurística, por certeza descendente):
 *   sin mensajes                                    → abierto        [certero]
 *   último mensaje del cliente                      → abierto        [certero]
 *   último interno CON archivos                     → resuelto       [alta]
 *   último interno sin archivos, pero hubo uno
 *     interno anterior con archivos                 → resuelto       [alta]
 *   solo mensajes internos, ninguno con archivos    → abierto + REVISAR
 *
 * Un derecho de petición / tutela se entrega COMO DOCUMENTO, así que el mensaje
 * interno con adjuntos es la señal de entrega. `fechaResolucion` sale de la fecha
 * de ESE mensaje — mucho mejor que `fechaCompletado`, que hoy se pisa en cada
 * mensaje interno y por eso no es una fecha de entrega real.
 *
 * Los casos dudosos quedan con `estadoMigradoRevisar: true` para que la pantalla
 * global los pueda filtrar y un abogado los corrija a mano.
 *
 * También denormaliza `clienteId` y rellena `fechaLimite` si falta (docs anteriores
 * a esa funcionalidad), calculándola desde `tipo` + `fecha`.
 *
 * NO borra `completado` ni `fechaCompletado` (rollback barato; la limpieza va en la fase 5).
 * Idempotente: por defecto salta los documentos que ya tienen `estado`.
 *
 * Uso:
 *   node .\migrar-valores-agregados-estado.js                    → DRY-RUN (no escribe, reporta)
 *   node .\migrar-valores-agregados-estado.js --commit           → ejecuta la migración real
 *   node .\migrar-valores-agregados-estado.js --cliente=<id>     → solo un cliente (prueba)
 *   node .\migrar-valores-agregados-estado.js --verbose          → detalla cada VA
 *   node .\migrar-valores-agregados-estado.js --commit --rehacer → reprocesa los ya migrados
 */

const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ---- Flags ----
const ARGS = process.argv.slice(2);
const COMMIT = ARGS.includes("--commit");
const VERBOSE = ARGS.includes("--verbose");
const REHACER = ARGS.includes("--rehacer");
const CLIENTE_FILTRO =
  (ARGS.find((a) => a.startsWith("--cliente=")) || "").split("=")[1] || null;

// ---- Constantes de negocio ----
// Mismos plazos que calcularFechaLimite() en valorAgregadoService.ts
const DIAS_POR_TIPO = {
  "derecho de peticion": 10,
  tutela: 1,
  desacato: 1,
  "estudios contratos": 3,
};

const AUTOR_CLIENTE = "cliente";

// ---- Helpers ----
function tieneArchivos(msg) {
  return (
    (Array.isArray(msg.archivos) && msg.archivos.length > 0) ||
    Boolean(msg.archivoURL)
  );
}

function esDelCliente(msg) {
  return String(msg.autorTipo || "") === AUTOR_CLIENTE;
}

function calcularFechaLimite(tipo, fechaBase) {
  const dias = DIAS_POR_TIPO[String(tipo || "").trim().toLowerCase()] ?? 3;
  const f = new Date(fechaBase);
  f.setDate(f.getDate() + dias);
  return f;
}

/**
 * El corazón de la migración: deriva estado/turno desde la conversación.
 * Devuelve { estado, esperaRespuestaDe, fechaResolucion, revisar, razon }.
 */
function derivarEstado(mensajes) {
  if (mensajes.length === 0) {
    return {
      estado: "abierto",
      esperaRespuestaDe: "juridica",
      fechaResolucion: null,
      revisar: false,
      razon: "sin mensajes",
    };
  }

  const ultimo = mensajes[mensajes.length - 1];

  if (esDelCliente(ultimo)) {
    return {
      estado: "abierto",
      esperaRespuestaDe: "juridica",
      fechaResolucion: null,
      revisar: false,
      razon: "ultimo mensaje del cliente",
    };
  }

  // Último mensaje interno. Buscar la entrega = mensaje interno más reciente con adjuntos.
  const entrega = [...mensajes]
    .reverse()
    .find((m) => !esDelCliente(m) && tieneArchivos(m));

  if (entrega) {
    return {
      estado: "resuelto",
      esperaRespuestaDe: "cliente",
      fechaResolucion: entrega.fecha ?? null,
      revisar: false,
      razon: tieneArchivos(ultimo)
        ? "ultimo interno con archivos"
        : "entrega interna previa con archivos",
    };
  }

  // Solo comentarios internos, nunca se adjuntó nada: no hay evidencia de entrega.
  return {
    estado: "abierto",
    esperaRespuestaDe: "cliente",
    fechaResolucion: null,
    revisar: true,
    razon: "solo mensajes internos sin adjuntos",
  };
}

async function main() {
  console.log("=".repeat(72));
  console.log(
    COMMIT
      ? "MIGRACIÓN REAL (--commit) — se van a escribir documentos"
      : "DRY-RUN — no se escribe nada. Usa --commit para ejecutar."
  );
  if (CLIENTE_FILTRO) console.log(`Filtro: solo cliente ${CLIENTE_FILTRO}`);
  if (REHACER) console.log("Modo --rehacer: se reprocesan los ya migrados.");
  console.log("=".repeat(72));

  const clientesSnap = CLIENTE_FILTRO
    ? [await db.doc(`clientes/${CLIENTE_FILTRO}`).get()].filter((d) => d.exists)
    : (await db.collection("clientes").get()).docs;

  if (clientesSnap.length === 0) {
    console.log("No hay clientes que procesar.");
    return;
  }

  const stats = {
    clientesConVA: 0,
    total: 0,
    saltados: 0,
    abierto: 0,
    resuelto: 0,
    revisar: 0,
    esperaJuridica: 0,
    esperaCliente: 0,
    fechaLimiteRellenada: 0,
    // Cuántos habrían quedado distinto si se hubiera migrado desde `completado`
    difieren: 0,
    razones: {},
    errores: 0,
  };

  let batch = db.batch();
  let enBatch = 0;

  async function flush() {
    if (!COMMIT || enBatch === 0) return;
    await batch.commit();
    batch = db.batch();
    enBatch = 0;
  }

  for (const clienteDoc of clientesSnap) {
    const clienteId = clienteDoc.id;
    const vaSnap = await clienteDoc.ref.collection("valoresAgregados").get();
    if (vaSnap.empty) continue;

    stats.clientesConVA += 1;
    const nombreCliente = clienteDoc.data()?.nombre || clienteId;

    for (const vaDoc of vaSnap.docs) {
      try {
        const data = vaDoc.data() || {};

        if (data.estado && !REHACER) {
          stats.saltados += 1;
          continue;
        }

        stats.total += 1;

        // Conversación ordenada por fecha ascendente
        const convSnap = await vaDoc.ref
          .collection("conversacion")
          .orderBy("fecha", "asc")
          .get();
        const mensajes = convSnap.docs.map((d) => d.data() || {});

        const derivado = derivarEstado(mensajes);

        const patch = {
          clienteId,
          estado: derivado.estado,
          esperaRespuestaDe: derivado.esperaRespuestaDe,
          fechaResolucion: derivado.fechaResolucion,
          resueltoPor: data.resueltoPor ?? null,
        };

        if (derivado.revisar) patch.estadoMigradoRevisar = true;

        // fechaLimite: solo si falta. Nunca se recalcula si ya existe.
        if (!data.fechaLimite) {
          const base =
            data.fecha && typeof data.fecha.toDate === "function"
              ? data.fecha.toDate()
              : new Date();
          patch.fechaLimite = admin.firestore.Timestamp.fromDate(
            calcularFechaLimite(data.tipo, base)
          );
          stats.fechaLimiteRellenada += 1;
        }

        // Comparar contra lo que habría dado la derivación ingenua desde `completado`
        const ingenuo = data.completado === true ? "resuelto" : "abierto";
        if (ingenuo !== derivado.estado) stats.difieren += 1;

        stats[derivado.estado] += 1;
        if (derivado.revisar) stats.revisar += 1;
        if (derivado.esperaRespuestaDe === "juridica") stats.esperaJuridica += 1;
        else stats.esperaCliente += 1;
        stats.razones[derivado.razon] = (stats.razones[derivado.razon] || 0) + 1;

        if (VERBOSE) {
          const marca = ingenuo !== derivado.estado ? " ⟂" : "  ";
          console.log(
            `${marca} ${nombreCliente} · ${data.tipo || "?"} · ${(data.titulo || "(sin título)").slice(0, 38)}` +
              ` → ${derivado.estado}/${derivado.esperaRespuestaDe}` +
              ` (${derivado.razon}${derivado.revisar ? ", REVISAR" : ""})` +
              ` [msgs:${mensajes.length}, completado:${data.completado === true}]`
          );
        }

        if (COMMIT) {
          batch.update(vaDoc.ref, patch);
          enBatch += 1;
          if (enBatch >= 400) await flush();
        }
      } catch (err) {
        stats.errores += 1;
        console.error(
          `  ✗ Error en clientes/${clienteId}/valoresAgregados/${vaDoc.id}:`,
          err.message
        );
      }
    }
  }

  await flush();

  console.log("");
  console.log("=".repeat(72));
  console.log("RESUMEN");
  console.log("=".repeat(72));
  console.log(`Clientes con valores agregados : ${stats.clientesConVA}`);
  console.log(`Procesados                     : ${stats.total}`);
  console.log(`Saltados (ya migrados)         : ${stats.saltados}`);
  console.log("");
  console.log(`  estado = abierto             : ${stats.abierto}`);
  console.log(`  estado = resuelto            : ${stats.resuelto}`);
  console.log("");
  console.log(`  esperaRespuestaDe = juridica : ${stats.esperaJuridica}   ← cola real del área jurídica`);
  console.log(`  esperaRespuestaDe = cliente  : ${stats.esperaCliente}`);
  console.log("");
  console.log(`  fechaLimite rellenada        : ${stats.fechaLimiteRellenada}`);
  console.log(`  marcados para revisar        : ${stats.revisar}`);
  console.log(
    `  distinto a derivar de        : ${stats.difieren}   ← los que 'completado' habria clasificado mal`
  );
  console.log(`  errores                      : ${stats.errores}`);
  console.log("");
  console.log("Desglose por razón:");
  Object.entries(stats.razones)
    .sort((a, b) => b[1] - a[1])
    .forEach(([razon, n]) => console.log(`  ${String(n).padStart(5)}  ${razon}`));
  console.log("");
  console.log(
    COMMIT
      ? "✔ Migración aplicada."
      : "Dry-run terminado. Nada fue escrito. Revisa los números y corre con --commit."
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error fatal:", err);
    process.exit(1);
  });
