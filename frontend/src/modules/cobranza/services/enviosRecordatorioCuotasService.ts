import {
  collectionGroup,
  getDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase";

/**
 * Consulta de los envios que ha hecho la Cloud Function `recordatorioCuotasAcuerdo`.
 *
 * Es una vista de DIAGNOSTICO, para vigilar la automatizacion durante sus
 * primeros dias. No hay coleccion de bitacora: se leen los mismos seguimientos
 * que escribe el job, filtrados por su autor (`ejecutivoUID: "sistema"`, que hoy
 * no usa nadie mas). Eso la hace retroactiva — ve lo que ya se envio, sin haber
 * tenido que instrumentar nada antes.
 *
 * FRAGILIDAD ACEPTADA: el resultado de cada envio se deduce del texto de la
 * descripcion, porque el job no guarda un campo aparte. Los tres prefijos que se
 * buscan aqui son los que arma `descripcionSeguimiento` en
 * `functions/src/acuerdos/recordatorioCuotas.ts`: si alla cambia la redaccion,
 * hay que cambiarla aqui. Cuando esta vista deje de ser temporal, lo correcto es
 * que el job escriba `origen` y `resultado` como campos propios.
 */

/** Marca con la que arranca toda descripcion escrita por el job. */
const PREFIJO = "Recordatorio automatico";

/** El job escribe en una u otra segun la tipificacion del deudor. */
const COLECCIONES = ["seguimiento", "seguimientoJuridico"] as const;

export type ResultadoEnvio = "enviado" | "sin_dato" | "error" | "desconocido";

export interface EnvioRecordatorio {
  id: string;
  clienteId: string;
  deudorId: string;
  /** Se resuelve aparte, leyendo el deudor. */
  deudorNombre?: string;
  clienteNombre?: string;
  canal: string;
  descripcion: string;
  resultado: ResultadoEnvio;
  fecha: Date | null;
}

/** Deduce el desenlace a partir del texto. Ver la nota de fragilidad de arriba. */
function deducirResultado(descripcion: string): ResultadoEnvio {
  if (descripcion.includes("Enviado por")) return "enviado";
  if (descripcion.includes("No se envio por")) return "sin_dato";
  if (descripcion.includes("Fallo el envio por")) return "error";
  return "desconocido";
}

function aFecha(valor: any): Date | null {
  if (!valor) return null;
  if (valor instanceof Timestamp) return valor.toDate();
  if (typeof valor?.toDate === "function") return valor.toDate();
  return null;
}

/**
 * Los ultimos envios, de los dos tipos de seguimiento, ya mezclados y ordenados
 * del mas reciente al mas viejo.
 *
 * Los nombres de deudor y conjunto se resuelven despues, y solo una vez por
 * cada uno: una corrida le escribe dos veces al mismo deudor (correo y
 * WhatsApp), y sin deduplicar se pagaria esa lectura dos veces.
 */
export async function listarEnviosRecordatorio(tope = 100): Promise<EnvioRecordatorio[]> {
  const consultas = COLECCIONES.map((col) =>
    getDocs(
      query(
        collectionGroup(db, col),
        where("ejecutivoUID", "==", "sistema"),
        orderBy("fechaCreacion", "desc"),
        limit(tope)
      )
    )
  );

  const resultados = await Promise.all(consultas);

  const envios: EnvioRecordatorio[] = [];

  for (const snap of resultados) {
    for (const d of snap.docs) {
      const data = d.data() as any;
      const descripcion = String(data?.descripcion ?? "");

      // Red de seguridad por si "sistema" llega a usarse en otro modulo.
      if (!descripcion.startsWith(PREFIJO)) continue;

      // clientes/{clienteId}/deudores/{deudorId}/{coleccion}/{id}
      const deudorRef = d.ref.parent.parent;
      const clienteId = deudorRef?.parent.parent?.id;
      if (!deudorRef || !clienteId) continue;

      envios.push({
        id: d.id,
        clienteId,
        deudorId: deudorRef.id,
        canal: String(data?.tipoSeguimiento ?? ""),
        descripcion,
        resultado: deducirResultado(descripcion),
        fecha: aFecha(data?.fechaCreacion ?? data?.fecha),
      });
    }
  }

  envios.sort((a, b) => (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0));
  const recortados = envios.slice(0, tope);

  // ── Nombres, una sola lectura por deudor y por conjunto ──
  const deudores = new Map<string, string>();
  const clientes = new Map<string, string>();

  await Promise.all(
    [...new Set(recortados.map((e) => `${e.clienteId}/${e.deudorId}`))].map(async (clave) => {
      const [clienteId, deudorId] = clave.split("/");
      try {
        const snap = await getDoc(doc(db, `clientes/${clienteId}/deudores/${deudorId}`));
        if (snap.exists()) {
          const d = snap.data() as any;
          deudores.set(clave, String(d?.nombre ?? d?.nombreResponsable ?? deudorId));
        }
      } catch {
        /* un deudor borrado no debe tumbar la vista */
      }
    })
  );

  await Promise.all(
    [...new Set(recortados.map((e) => e.clienteId))].map(async (clienteId) => {
      try {
        const snap = await getDoc(doc(db, `clientes/${clienteId}`));
        if (snap.exists()) {
          clientes.set(clienteId, String((snap.data() as any)?.nombre ?? clienteId));
        }
      } catch {
        /* idem */
      }
    })
  );

  return recortados.map((e) => ({
    ...e,
    deudorNombre: deudores.get(`${e.clienteId}/${e.deudorId}`) ?? e.deudorId,
    clienteNombre: clientes.get(e.clienteId) ?? e.clienteId,
  }));
}
