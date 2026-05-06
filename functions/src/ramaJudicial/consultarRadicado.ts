import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import fetch from "node-fetch";

const CPNU_BASE = "https://consultaprocesos.ramajudicial.gov.co:448/api/v2";

export interface Actuacion {
  numero: number;
  fecha: string;
  tipo: string;
  anotacion: string;
  conDocumentos: boolean;
}

export interface ResultadoConsulta {
  fuente: "CPNU";
  radicado: string;
  despacho: string;
  departamento: string;
  sujetosProcesales: string;
  fechaUltimaActuacion: string | null;
  esPrivado: boolean;
  actuaciones: Actuacion[];
  totalActuaciones: number;
}

async function consultarCPNU(radicado: string): Promise<ResultadoConsulta | null> {
  try {
    const res = await fetch(
      `${CPNU_BASE}/Procesos/Consulta/NumeroRadicacion?numero=${radicado}&SoloActivos=false&pagina=1`,
      { headers: { Accept: "application/json" }, timeout: 10000 } as any
    );
    if (!res.ok) return null;

    const data = await res.json() as any;
    const lista: any[] = Array.isArray(data) ? data : (data.procesos ?? []);
    if (!lista.length) return null;

    const proc = lista[0];

    if (proc.esPrivado || !proc.idProceso) {
      return {
        fuente: "CPNU",
        radicado: proc.llaveProceso ?? radicado,
        despacho: proc.despacho ?? "",
        departamento: proc.departamento ?? "",
        sujetosProcesales: proc.sujetosProcesales ?? "",
        fechaUltimaActuacion: null,
        esPrivado: true,
        actuaciones: [],
        totalActuaciones: 0,
      };
    }

    const actRes = await fetch(
      `${CPNU_BASE}/Proceso/Actuaciones/${proc.idProceso}?pagina=1`,
      { timeout: 10000 } as any
    );

    let actuaciones: Actuacion[] = [];
    let total = 0;
    if (actRes.ok) {
      const actData = await actRes.json() as any;
      total = actData.cantidadRegistros ?? 0;
      actuaciones = (actData.actuaciones ?? []).map((a: any) => ({
        numero: a.consActuacion ?? 0,
        fecha: (a.fechaActuacion ?? "").split("T")[0],
        tipo: a.actuacion ?? "",
        anotacion: a.anotacion ?? "",
        conDocumentos: a.conDocumentos ?? false,
      }));
    }

    return {
      fuente: "CPNU",
      radicado: proc.llaveProceso ?? radicado,
      despacho: proc.despacho ?? "",
      departamento: proc.departamento ?? "",
      sujetosProcesales: proc.sujetosProcesales ?? "",
      fechaUltimaActuacion: (proc.fechaUltimaActuacion ?? "").split("T")[0] || null,
      esPrivado: false,
      actuaciones,
      totalActuaciones: total,
    };
  } catch (err) {
    logger.error("[CPNU] error", err);
    return null;
  }
}

export const consultarRadicado = onRequest(
  {
    memory: "256MiB",
    timeoutSeconds: 30,
    region: "us-central1",
  },
  async (req, res): Promise<void> => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      res.status(401).json({ error: "No autenticado." });
      return;
    }
    try {
      await admin.auth().verifyIdToken(token);
    } catch {
      res.status(401).json({ error: "Token inválido." });
      return;
    }

    const { radicado } = req.body as { radicado?: string };
    if (!radicado || radicado.length !== 23 || !/^\d+$/.test(radicado)) {
      res.status(400).json({ error: "El radicado debe tener exactamente 23 dígitos." });
      return;
    }

    logger.info("[consultarRadicado]", { radicado });

    const resultado = await consultarCPNU(radicado);
    if (resultado) {
      res.status(200).json(resultado);
      return;
    }

    res.status(404).json({
      error: "No se encontró el proceso en Rama Judicial. Verifica el número de radicado.",
    });
  }
);
