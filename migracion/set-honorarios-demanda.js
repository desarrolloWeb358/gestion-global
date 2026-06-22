/* eslint-disable no-console */
/**
 * Recorre clientes y sus deudores.
 * Si tipificacion es "Demanda" o "Demanda/Acuerdo" => porcentajeHonorarios = 20
 *
 * Modos:
 *  - SOLO_UN_CLIENTE = true  -> procesa solo un cliente (pruebas)
 *  - SOLO_UN_CLIENTE = false -> procesa todos los clientes
 *
 * Ejecutar:
 *   node set-honorarios-demanda.js
 */

const admin = require("firebase-admin");
const path = require("path");

// ===================
// CONFIGURACIÓN
// ===================
const SERVICE_ACCOUNT_PATH = "./serviceAccountKey.json";

// ===== MODO DE EJECUCIÓN =====
const SOLO_UN_CLIENTE = false;              // 🔴 CAMBIA A false PARA PRODUCCIÓN
const CLIENTE_TEST_UID = "nl28GZJnFITNc7GVlJ63XNk8qn42";      // UID del cliente de prueba

// Subcolección
const SUBCOL_DEUDORES = "deudores";

// Reglas
const TIPIFICACIONES_20 = new Set([
    "Demanda",
    "Demanda/Acuerdo",
    "Demanda/Terminado",
    "Demanda/Insolvencia",
]);

const CAMPO_PORCENTAJE = "porcentajeHonorarios";
const VALOR_20 = 20;
const VALOR_DEFAULT = 15;


// Simulación
const DRY_RUN = false; // true = no escribe

// Paginación
const PAGE_SIZE_CLIENTES = 200;
const PAGE_SIZE_DEUDORES = 400;

// Pausas
const SLEEP_MS = 5;

// ===================
// INICIALIZACIÓN
// ===================
admin.initializeApp({
    credential: admin.credential.cert(require(path.resolve(SERVICE_ACCOUNT_PATH))),
});

const db = admin.firestore();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const normalizar = (v) => String(v || "").trim();
const esTip20 = (tip) => TIPIFICACIONES_20.has(normalizar(tip));


// ===================
// LÓGICA
// ===================
async function procesarDeudoresDeCliente(clientRef, bulkWriter) {
    let lastDoc = null;
    let leidos = 0;
    let actualizados = 0;

    while (true) {
        let q = clientRef
            .collection(SUBCOL_DEUDORES)
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(PAGE_SIZE_DEUDORES);

        if (lastDoc) q = q.startAfter(lastDoc);

        const snap = await q.get();
        if (snap.empty) break;

        for (const doc of snap.docs) {
            leidos++;
            const data = doc.data() || {};

            const nuevoValor = esTip20(data.tipificacion) ? VALOR_20 : VALOR_DEFAULT;

            const actual = Number(data[CAMPO_PORCENTAJE]);
            const yaEsta = Number.isFinite(actual) && actual === nuevoValor;
            if (yaEsta) continue;

            actualizados++;

            if (DRY_RUN) {
                console.log(
                    `🧪 DRY_RUN -> ${doc.ref.path} | tipificacion="${data.tipificacion}" => ${CAMPO_PORCENTAJE}=${nuevoValor}`
                );
            } else {
                bulkWriter.update(doc.ref, {
                    [CAMPO_PORCENTAJE]: nuevoValor,
                });
            }

        }

        lastDoc = snap.docs[snap.docs.length - 1];
    }

    return { leidos, actualizados };
}

// ===================
// MAIN
// ===================
(async function main() {
    console.log("=== Actualización porcentajeHonorarios (Demanda) ===");
    console.log(`Modo: ${DRY_RUN ? "DRY_RUN" : "ESCRITURA REAL"}`);
    console.log(`Clientes: ${SOLO_UN_CLIENTE ? "UNO (PRUEBA)" : "TODOS"}`);

    const bulkWriter = db.bulkWriter();

    bulkWriter.onWriteError((error) => {
        console.error(`❌ Error en ${error.documentRef.path}: ${error.message}`);
        return error.failedAttempts < 3;
    });

    let totalClientes = 0;
    let totalLeidos = 0;
    let totalActualizados = 0;

    try {
        if (SOLO_UN_CLIENTE) {
            const clientRef = db.collection("clientes").doc(CLIENTE_TEST_UID);
            const snap = await clientRef.get();

            if (!snap.exists) {
                console.error(`⛔️ El cliente ${CLIENTE_TEST_UID} no existe`);
                process.exit(1);
            }

            const res = await procesarDeudoresDeCliente(clientRef, bulkWriter);
            totalClientes = 1;
            totalLeidos = res.leidos;
            totalActualizados = res.actualizados;

            console.log(
                `✅ clientes/${CLIENTE_TEST_UID}: leídos=${res.leidos}, actualizados=${res.actualizados}`
            );
        } else {
            let lastClient = null;

            while (true) {
                let q = db.collection("clientes")
                    .orderBy(admin.firestore.FieldPath.documentId())
                    .limit(PAGE_SIZE_CLIENTES);

                if (lastClient) q = q.startAfter(lastClient);

                const snap = await q.get();
                if (snap.empty) break;

                for (const c of snap.docs) {
                    totalClientes++;
                    const res = await procesarDeudoresDeCliente(c.ref, bulkWriter);
                    totalLeidos += res.leidos;
                    totalActualizados += res.actualizados;

                    console.log(
                        `✅ ${c.ref.path}: leídos=${res.leidos}, actualizados=${res.actualizados}`
                    );

                    await sleep(SLEEP_MS);
                }

                lastClient = snap.docs[snap.docs.length - 1];
            }
        }
    } catch (e) {
        console.error("❌ Error general:", e?.message || e);
    } finally {
        await bulkWriter.close();
    }

    console.log("\n=== RESUMEN ===");
    console.log(`Clientes procesados: ${totalClientes}`);
    console.log(`Deudores leídos: ${totalLeidos}`);
    console.log(`Deudores actualizados: ${totalActualizados}`);
    console.log("\n🚀 Proceso terminado");

    process.exit(0);
})();
