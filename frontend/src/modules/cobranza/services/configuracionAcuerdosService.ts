import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";

/**
 * Configuracion del recordatorio de cuotas de acuerdos de pago.
 *
 * Vive junto a los demas catalogos internos (configuracion/eventos,
 * configuracion/tareas) pero en documento propio: este recordatorio le escribe
 * al DEUDOR, no al equipo, asi que se enciende y se apaga por separado.
 *
 * Se administra desde Ajustes > Recordatorio de cuotas y lo lee la Cloud
 * Function `recordatorioCuotasAcuerdo` (todos los dias a las 10:00 a. m.).
 */
const RUTA_CONFIG = "configuracion/acuerdos";

export interface ConfigAcuerdos {
  /** Apaga o enciende el recordatorio completo. */
  activa: boolean;
  /**
   * Dias de anticipacion con los que se le avisa al deudor, uno por aviso.
   * Del mas lejano al mas cercano: [5, 1] = cinco dias antes y la vispera.
   */
  diasAviso: number[];
  /**
   * Conjuntos a los que se les envia. Vacio = todos. Sirve para estrenar la
   * automatizacion contra una sola cartera antes de abrirla a la plataforma.
   */
  clientesPermitidos: string[];
  canalEmail: boolean;
  canalWhatsapp: boolean;
  /** Interruptor maestro del canal WhatsApp de este modulo. */
  whatsappActivo: boolean;
  /** Documento de la coleccion `numbers` que se usa para enviar. */
  numberId: string | null;
  /** Plantilla de Meta. Parametros nombrados: nombre, cuota, valor, fecha. */
  plantillaCuota: string;
}

export const CONFIG_ACUERDOS_POR_DEFECTO: ConfigAcuerdos = {
  activa: false,
  diasAviso: [5, 1],
  clientesPermitidos: [],
  canalEmail: true,
  canalWhatsapp: false,
  whatsappActivo: false,
  numberId: null,
  plantillaCuota: "recordatorio_cuota_acuerdo",
};

/** Un aviso con mas de un mes de anticipacion no es un recordatorio. */
export const MAX_DIAS_ANTES = 30;

/** Tope de avisos por cuota. Mas de tres mensajes por cuota ya es acoso. */
export const MAX_AVISOS = 3;

/**
 * Sanea la lista de hitos: enteros entre 0 y MAX_DIAS_ANTES, sin repetidos y
 * del mas lejano al mas cercano. Es la misma regla que aplica la Cloud Function
 * (`normalizarDiasAviso`), para que lo que se ve aqui sea lo que se envia.
 */
export function normalizarDiasAviso(valor: unknown): number[] {
  const dias = Array.isArray(valor) ? valor : [];
  return [
    ...new Set(
      dias
        .map((d) => Number(d))
        .filter((d) => Number.isFinite(d) && d >= 0 && d <= MAX_DIAS_ANTES)
        .map((d) => Math.round(d))
    ),
  ]
    .sort((a, b) => b - a)
    .slice(0, MAX_AVISOS);
}

/** Rellena lo que falte: el documento puede no existir o venir a medias. */
function normalizar(data: any): ConfigAcuerdos {
  const dias = normalizarDiasAviso(data?.diasAviso);
  return {
    activa: data?.activa === true,
    diasAviso: dias.length > 0 ? dias : CONFIG_ACUERDOS_POR_DEFECTO.diasAviso,
    clientesPermitidos: Array.isArray(data?.clientesPermitidos)
      ? data.clientesPermitidos.map((c: any) => String(c ?? "").trim()).filter(Boolean)
      : [],
    canalEmail: data?.canalEmail !== false,
    canalWhatsapp: data?.canalWhatsapp === true,
    whatsappActivo: data?.whatsappActivo === true,
    numberId: data?.numberId ?? null,
    plantillaCuota: data?.plantillaCuota ?? CONFIG_ACUERDOS_POR_DEFECTO.plantillaCuota,
  };
}

export async function obtenerConfigAcuerdos(): Promise<ConfigAcuerdos> {
  const snap = await getDoc(doc(db, RUTA_CONFIG));
  return normalizar(snap.exists() ? snap.data() : null);
}

export async function guardarConfigAcuerdos(config: ConfigAcuerdos): Promise<void> {
  await setDoc(doc(db, RUTA_CONFIG), config, { merge: true });
}
