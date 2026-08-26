/* eslint-disable no-console */
/**
 * Lista los valores agregados que NUNCA han sido contestados (sin un solo mensaje
 * en la subcolección `conversacion`) y los que quedaron dudosos para la migración
 * de estados (solo mensajes internos, ningún adjunto).
 *
 * Sirve para el paso 1 del despliegue: revisar y limpiar antes de migrar, porque
 * después estos aparecen todos juntos en la pantalla de seguimiento.
 *
 * Es de SOLO LECTURA. No escribe nada nunca.
 *
 * Uso:
 *   node .\listar-valores-agregados-sin-responder.js
 *   node .\listar-valores-agregados-sin-responder.js --csv > pendientes.csv
 *   node .\listar-valores-agregados-sin-responder.js --min-dias=30
 */

const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const ARGS = process.argv.slice(2);
const CSV = ARGS.includes("--csv");
const MIN_DIAS = Number(
  (ARGS.find((a) => a.startsWith("--min-dias=")) || "").split("=")[1] || 0
);

// Mismos plazos que calcularFechaLimite() en valorAgregadoService.ts
const DIAS_POR_TIPO = {
  "derecho de peticion": 10,
  tutela: 1,
  desacato: 1,
  "estudios contratos": 3,
};

const HOY = new Date();
const dias = (d) => (d ? Math.floor((HOY - d) / 86400000) : null);
const toDate = (v) => (v && typeof v.toDate === "function" ? v.toDate() : null);

function tieneArchivos(m) {
  return (Array.isArray(m.archivos) && m.archivos.length > 0) || Boolean(m.archivoURL);
}

async function main() {
  const clientes = (await db.collection("clientes").get()).docs;

  const sinResponder = [];
  const dudosos = [];

  for (const c of clientes) {
    const nombreCliente = c.data()?.nombre || c.id;
    const vaSnap = await c.ref.collection("valoresAgregados").get();

    for (const v of vaSnap.docs) {
      const d = v.data() || {};
      const conv = await v.ref.collection("conversacion").get();
      const msgs = conv.docs.map((m) => m.data() || {});

      const fecha = toDate(d.fecha);
      const edad = dias(fecha);
      if (MIN_DIAS && (edad ?? 0) < MIN_DIAS) continue;

      const tipo = String(d.tipo || "").trim().toLowerCase();
      const plazo = DIAS_POR_TIPO[tipo] ?? 3;

      const fila = {
        clienteId: c.id,
        cliente: nombreCliente,
        valorId: v.id,
        tipo: d.tipo || "?",
        titulo: (d.titulo || "(sin titulo)").replace(/[\r\n;]+/g, " ").trim(),
        edad,
        // Días transcurridos por encima del plazo legal del tipo.
        vencidoPor: edad === null ? null : edad - plazo,
        mensajes: msgs.length,
      };

      if (msgs.length === 0) {
        sinResponder.push(fila);
      } else {
        const soloInternos = msgs.every((m) => m.autorTipo !== "cliente");
        const conAdjuntos = msgs.some(tieneArchivos);
        if (soloInternos && !conAdjuntos) dudosos.push(fila);
      }
    }
  }

  const porEdad = (a, b) => (b.edad ?? 0) - (a.edad ?? 0);
  sinResponder.sort(porEdad);
  dudosos.sort(porEdad);

  if (CSV) {
    console.log(
      "grupo;clienteId;cliente;valorId;tipo;titulo;diasDesdeRadicacion;diasSobreElPlazo;mensajes"
    );
    const linea = (g) => (f) =>
      console.log(
        [g, f.clienteId, f.cliente, f.valorId, f.tipo, f.titulo, f.edad, f.vencidoPor, f.mensajes].join(";")
      );
    sinResponder.forEach(linea("sin_responder"));
    dudosos.forEach(linea("dudoso"));
    return;
  }

  const tabla = (titulo, arr, nota) => {
    console.log("");
    console.log("=".repeat(96));
    console.log(`${titulo} (${arr.length})`);
    if (nota) console.log(nota);
    console.log("=".repeat(96));
    if (arr.length === 0) {
      console.log("  (ninguno)");
      return;
    }
    console.log(
      "  " +
        "DÍAS".padStart(5) +
        "  " +
        "+PLAZO".padStart(7) +
        "  " +
        "CLIENTE".padEnd(28) +
        "  " +
        "TIPO".padEnd(20) +
        "  TÍTULO"
    );
    arr.forEach((f) => {
      const marca = (f.vencidoPor ?? 0) > 0 ? `+${f.vencidoPor}` : "—";
      console.log(
        "  " +
          String(f.edad ?? "?").padStart(5) +
          "  " +
          marca.padStart(7) +
          "  " +
          String(f.cliente).slice(0, 28).padEnd(28) +
          "  " +
          String(f.tipo).slice(0, 20).padEnd(20) +
          "  " +
          f.titulo.slice(0, 46)
      );
    });
  };

  tabla(
    "SIN NINGUNA RESPUESTA — radicados y nunca contestados",
    sinResponder,
    "Estos aparecerán como 'Abierto · esperando a jurídica' en la pantalla nueva."
  );
  tabla(
    "DUDOSOS — solo mensajes internos, ningún adjunto",
    dudosos,
    "La migración los deja 'abierto' + 'Requiere revisión' para que alguien los cierre a mano."
  );

  const vencidos = sinResponder.filter((f) => (f.vencidoPor ?? 0) > 0).length;
  console.log("");
  console.log(
    `Total: ${sinResponder.length} sin responder (${vencidos} por encima del plazo legal) · ${dudosos.length} dudosos`
  );
  console.log("Exporta con --csv para pasarlo a jurídica.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error fatal:", err);
    process.exit(1);
  });
