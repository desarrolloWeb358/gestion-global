/* eslint-disable no-console */
/**
 * Normaliza `ubicacion` de todos los deudores a minúsculas y sin espacios sobrantes.
 *
 * Contexto: `crearDeudor` siempre guardó la ubicación normalizada, pero los dos
 * formularios de edición la guardaban con `.trim()` a secas, conservando mayúsculas.
 * Como la validación de duplicados compara por IGUALDAD EXACTA
 * (`where("ubicacion", "==", ...)`), un deudor que quedó como "Apto 101" es invisible
 * para esa consulta: se puede crear "apto 101" al lado y quedan dos dueños del mismo
 * inmueble. El código ya normaliza en create y update; esto arregla lo que quedó sucio.
 *
 * Colisiones: si al normalizar dos deudores de la misma cartera caen en la misma
 * ubicación, el script NO escribe ninguno de los dos y los reporta. Fusionarlos o
 * decidir cuál sobra es un juicio de negocio (uno puede estar Terminado y el otro
 * Gestionando, con estados mensuales y acuerdos propios), no algo que deba hacer
 * una migración a ciegas.
 *
 * Idempotente: los documentos ya normalizados se saltan.
 *
 * Uso:
 *   node .\normalizar-ubicaciones-deudores.js                  → DRY-RUN (no escribe, reporta)
 *   node .\normalizar-ubicaciones-deudores.js --commit         → aplica los cambios
 *   node .\normalizar-ubicaciones-deudores.js --cliente=<id>   → solo una cartera (prueba)
 *   node .\normalizar-ubicaciones-deudores.js --verbose        → lista cada deudor tocado
 */

const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json")),
});
const db = admin.firestore();

const COMMIT = process.argv.includes("--commit");
const VERBOSE = process.argv.includes("--verbose");
const CLIENTE = (process.argv.find((a) => a.startsWith("--cliente=")) || "").split("=")[1];

const normalizarUbicacion = (u) => String(u ?? "").trim().toLowerCase();

async function main() {
  console.log(COMMIT ? "MODO COMMIT — se van a escribir cambios\n" : "DRY-RUN — no se escribe nada\n");

  const clientesSnap = CLIENTE
    ? { docs: [await db.collection("clientes").doc(CLIENTE).get()] }
    : await db.collection("clientes").get();

  const stats = { carteras: 0, deudores: 0, normalizados: 0, yaOk: 0, sinUbicacion: 0, colisiones: 0 };
  const colisiones = [];
  let batch = db.batch();
  let enBatch = 0;

  for (const clienteDoc of clientesSnap.docs) {
    if (!clienteDoc.exists) {
      console.log(`Cartera ${CLIENTE} no existe.`);
      continue;
    }

    const nombreCartera = String(clienteDoc.data().nombre || clienteDoc.id);
    const deudoresSnap = await clienteDoc.ref.collection("deudores").get();
    if (deudoresSnap.empty) continue;

    stats.carteras++;
    stats.deudores += deudoresSnap.size;

    // Agrupar por ubicación normalizada para detectar los choques ANTES de escribir.
    const porUbicacion = new Map();
    for (const d of deudoresSnap.docs) {
      const norm = normalizarUbicacion(d.data().ubicacion);
      if (!norm) {
        stats.sinUbicacion++;
        if (VERBOSE) console.log(`  [sin ubicación] ${nombreCartera} · ${d.id} · ${d.data().nombre || ""}`);
        continue;
      }
      if (!porUbicacion.has(norm)) porUbicacion.set(norm, []);
      porUbicacion.get(norm).push(d);
    }

    for (const [norm, docs] of porUbicacion) {
      if (docs.length > 1) {
        stats.colisiones++;
        colisiones.push({
          cartera: nombreCartera,
          clienteId: clienteDoc.id,
          ubicacion: norm,
          deudores: docs.map((d) => ({
            id: d.id,
            nombre: String(d.data().nombre || "(sin nombre)"),
            ubicacionActual: String(d.data().ubicacion ?? ""),
            tipificacion: String(d.data().tipificacion || "(sin tipificación)"),
          })),
        });
        continue; // no se toca ninguno de los dos
      }

      const doc = docs[0];
      const actual = String(doc.data().ubicacion ?? "");
      if (actual === norm) {
        stats.yaOk++;
        continue;
      }

      stats.normalizados++;
      if (VERBOSE) {
        console.log(`  ${nombreCartera} · ${doc.data().nombre || doc.id}: "${actual}" → "${norm}"`);
      }

      if (COMMIT) {
        batch.update(doc.ref, { ubicacion: norm });
        enBatch++;
        if (enBatch >= 450) {
          await batch.commit();
          batch = db.batch();
          enBatch = 0;
        }
      }
    }
  }

  if (COMMIT && enBatch > 0) await batch.commit();

  console.log("");
  console.log("Resumen");
  console.log(`  carteras revisadas   : ${stats.carteras}`);
  console.log(`  deudores revisados   : ${stats.deudores}`);
  console.log(`  ya normalizados      : ${stats.yaOk}`);
  console.log(`  normalizados ahora   : ${stats.normalizados}`);
  console.log(`  sin ubicación        : ${stats.sinUbicacion}`);
  console.log(`  colisiones (no tocadas): ${stats.colisiones}`);

  if (colisiones.length) {
    console.log("");
    console.log("⚠ Ubicaciones duplicadas — hay que resolverlas a mano:");
    for (const c of colisiones) {
      console.log(`\n  ${c.cartera}  (clienteId: ${c.clienteId})  → "${c.ubicacion}"`);
      for (const d of c.deudores) {
        console.log(`      ${d.id}  ${d.nombre}  [${d.tipificacion}]  guardado como "${d.ubicacionActual}"`);
      }
    }
  }

  console.log("");
  console.log(
    COMMIT
      ? "✔ Normalización aplicada."
      : "Dry-run terminado. Nada fue escrito. Revisa los números y corre con --commit."
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error fatal:", err);
    process.exit(1);
  });
