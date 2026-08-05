import { Timestamp } from "firebase/firestore";
import type { CuotaAcuerdo } from "@/modules/cobranza/models/acuerdoPago.model";

const round = (x: number) => Math.round(x);
const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Freno de seguridad: nunca generar más filas que esto. */
const MAX_CUOTAS = 240;

/**
 * Si la última cuota queda por debajo de este valor, se suma a la cuota anterior
 * en vez de dejar una "cola" muy pequeña.
 * (Único lugar donde se cambia el umbral).
 */
const MIN_ULTIMA_CUOTA = 50000;

export type BaseRecalculo = {
  capitalInicial: number;
  porcentajeHonorarios: number;
  /**
   * Cuota mensual pactada.
   *
   * Cuando se envía, la tabla se comporta como "viva":
   *  - la última fila (que siempre es residual) se vuelve a llenar con la cuota base
   *    si al cobrarla todavía quedaría saldo,
   *  - se agregan filas nuevas mientras quede saldo por cubrir,
   *  - se fusiona la cola si queda por debajo de MIN_ULTIMA_CUOTA.
   *
   * Si NO se envía, se respetan tal cual las filas recibidas (modo consulta/carga).
   */
  valorCuotaBase?: number;
};

const addMonths = (d: Date, months: number) => {
  const x = new Date(d);
  const day = x.getDate();
  x.setMonth(x.getMonth() + months);

  // evita saltos raros (31 -> feb)
  if (x.getDate() < day) x.setDate(0);
  return x;
};

const toDate = (v: any): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();
  return new Date(v);
};

function buildRow(
  c: CuotaAcuerdo,
  i: number,
  porcentaje: number,
  capSaldo: number,
  honSaldo: number
): { row: CuotaAcuerdo; capSaldo: number; honSaldo: number } {
  const capitalAntes = capSaldo;
  const honorariosAntes = honSaldo;

  // si ya está todo pagado, fila en 0 (por ahora)
  if (capSaldo <= 0 && honSaldo <= 0) {
    return {
      row: {
        ...c,
        numero: i + 1,
        valorCuota: 0,
        honorariosCuota: 0,
        capitalCuota: 0,
        honorariosSaldoAntes: 0,
        honorariosSaldoDespues: 0,
        capitalSaldoAntes: 0,
        capitalSaldoDespues: 0,
      },
      capSaldo: 0,
      honSaldo: 0,
    };
  }

  let valorCuota = round(n(c.valorCuota));

  // si el usuario dejó vacío/0, NO cortamos: solo no paga esta fila
  if (valorCuota <= 0) valorCuota = 0;

  // 1) prioridad honorarios
  let honorariosCuota = round(valorCuota * (porcentaje / 100));
  honorariosCuota = Math.min(honorariosCuota, honSaldo);

  // 2) resto a capital
  let capitalCuota = valorCuota - honorariosCuota;
  if (capSaldo <= 0) capitalCuota = 0;
  capitalCuota = Math.min(capitalCuota, capSaldo);

  // 3) valor real
  const valorReal = round(honorariosCuota + capitalCuota);

  const honDesp = round(honSaldo - honorariosCuota);
  const capDesp = round(capSaldo - capitalCuota);

  return {
    row: {
      ...c,
      numero: i + 1,
      valorCuota: valorReal,
      honorariosCuota: round(honorariosCuota),
      capitalCuota: round(capitalCuota),
      honorariosSaldoAntes: round(honorariosAntes),
      honorariosSaldoDespues: round(honDesp),
      capitalSaldoAntes: round(capitalAntes),
      capitalSaldoDespues: round(capDesp),
    },
    capSaldo: capDesp,
    honSaldo: honDesp,
  };
}

/** Recorre filas existentes tal cual vienen (sin extender ni recortar). */
function calcularFilas(
  cuotas: CuotaAcuerdo[],
  porcentaje: number,
  capInicial: number,
  honInicial: number
): { rows: CuotaAcuerdo[]; capSaldo: number; honSaldo: number } {
  let capSaldo = capInicial;
  let honSaldo = honInicial;

  const rows: CuotaAcuerdo[] = [];

  for (let i = 0; i < cuotas.length; i++) {
    const r = buildRow(cuotas[i], i, porcentaje, capSaldo, honSaldo);
    rows.push(r.row);
    capSaldo = r.capSaldo;
    honSaldo = r.honSaldo;
  }

  return { rows, capSaldo, honSaldo };
}

// ✅ Limpieza: elimina filas finales sobrantes (saldo 0 + cuota 0)
function trimTrailingZeroRows(rows: CuotaAcuerdo[]) {
  const out = [...rows];

  while (out.length > 0) {
    const last = out[out.length - 1];

    const capAntes = round(n(last.capitalSaldoAntes ?? 0));
    const honAntes = round(n(last.honorariosSaldoAntes ?? 0));
    const valor = round(n(last.valorCuota ?? 0));
    const capCuota = round(n(last.capitalCuota ?? 0));
    const honCuota = round(n(last.honorariosCuota ?? 0));

    // Fila basura típica: todo en 0
    const esFilaBasura =
      capAntes <= 0 &&
      honAntes <= 0 &&
      valor <= 0 &&
      capCuota <= 0 &&
      honCuota <= 0;

    if (!esFilaBasura) break;
    out.pop();
  }

  // renumerar por si quitamos filas
  return out.map((x, i) => ({ ...x, numero: i + 1 }));
}

/**
 * ✅ Si la última cuota quedó muy pequeña, se suma a la anterior.
 * Ej: ... 230.000 / 230.000 / 24.990  ->  ... 230.000 / 254.990
 */
function fusionarColaPequena(rows: CuotaAcuerdo[]): CuotaAcuerdo[] {
  if (rows.length < 2) return rows;

  const last = rows[rows.length - 1];
  const valorUltima = round(n(last.valorCuota));

  if (valorUltima <= 0 || valorUltima >= MIN_ULTIMA_CUOTA) return rows;

  const out = rows.slice(0, -1).map((c) => ({ ...c }));
  const prev = out[out.length - 1];

  prev.capitalCuota = round(n(prev.capitalCuota) + n(last.capitalCuota));
  prev.honorariosCuota = round(n(prev.honorariosCuota) + n(last.honorariosCuota));
  prev.valorCuota = round(prev.capitalCuota + prev.honorariosCuota);
  prev.capitalSaldoDespues = round(n(last.capitalSaldoDespues));
  prev.honorariosSaldoDespues = round(n(last.honorariosSaldoDespues));

  return out.map((c, i) => ({ ...c, numero: i + 1 }));
}

/**
 * Recalcula desde `startIdx` hacia abajo:
 *  - respeta las filas anteriores (el usuario ya las fijó),
 *  - vuelve a llenar la última fila residual con la cuota base si falta saldo,
 *  - agrega filas nuevas mientras quede saldo,
 *  - recorta filas sobrantes en 0 y fusiona la cola pequeña.
 */
function recalcular(
  cuotas: CuotaAcuerdo[],
  startIdx: number,
  base: BaseRecalculo
): CuotaAcuerdo[] {
  const cap0 = round(n(base.capitalInicial));
  const porcentaje = n(base.porcentajeHonorarios);
  const hon0 = round(cap0 * (porcentaje / 100));
  const cuotaBase = round(n(base.valorCuotaBase));

  if (cuotas.length === 0) return [];

  const idx = Math.max(0, Math.min(startIdx, cuotas.length));

  // 1) prefijo: filas anteriores al cambio (sin extender ni recortar)
  const pre = calcularFilas(cuotas.slice(0, idx), porcentaje, cap0, hon0);

  let capSaldo = pre.capSaldo;
  let honSaldo = pre.honSaldo;
  const out: CuotaAcuerdo[] = [...pre.rows];

  // ancla para fechar las filas nuevas: la última fila que ya existe
  const anclaIdx = cuotas.length - 1;
  const anclaFecha = toDate(cuotas[anclaIdx]?.fechaPago);

  const tope = Math.max(cuotas.length, MAX_CUOTAS);

  // 2) desde la fila editada en adelante
  for (let i = idx; i < tope; i++) {
    const existente = cuotas[i];

    // --- fila nueva (extensión de la tabla) ---
    if (!existente) {
      if (cuotaBase <= 0) break;              // sin cuota base no sabemos cuánto cobrar
      if (capSaldo <= 0 && honSaldo <= 0) break;

      const nueva: CuotaAcuerdo = {
        numero: i + 1,
        fechaPago: Timestamp.fromDate(addMonths(anclaFecha, i - anclaIdx)),
        valorCuota: cuotaBase,
        honorariosCuota: 0,
        capitalCuota: 0,
        honorariosSaldoAntes: 0,
        honorariosSaldoDespues: 0,
        capitalSaldoAntes: 0,
        capitalSaldoDespues: 0,
        pagado: false,
      };

      const r = buildRow(nueva, i, porcentaje, capSaldo, honSaldo);
      out.push(r.row);
      capSaldo = r.capSaldo;
      honSaldo = r.honSaldo;
      continue;
    }

    // --- fila existente ---
    let solicitado = round(n(existente.valorCuota));

    // La última fila siempre es residual ("lo que falte"). Si al cobrarla todavía
    // quedaría saldo, hay que volver a llevarla a la cuota base y seguir generando.
    const esUltimaExistente = i === anclaIdx;
    if (
      esUltimaExistente &&
      cuotaBase > 0 &&
      solicitado < cuotaBase &&
      capSaldo + honSaldo > solicitado
    ) {
      solicitado = cuotaBase;
    }

    const r = buildRow({ ...existente, valorCuota: solicitado }, i, porcentaje, capSaldo, honSaldo);
    out.push(r.row);
    capSaldo = r.capSaldo;
    honSaldo = r.honSaldo;
  }

  const limpia = trimTrailingZeroRows(out);

  return cuotaBase > 0 ? fusionarColaPequena(limpia) : limpia;
}

/**
 * Recalcula TODA la tabla.
 */
export function recalcularTablaDesdeValorCuota(
  cuotas: CuotaAcuerdo[],
  base: BaseRecalculo
): CuotaAcuerdo[] {
  return recalcular(cuotas, 0, base);
}

/**
 * Recalcula DESDE una fila hacia abajo.
 */
export function recalcularTablaDesdeValorCuotaDesdeIndice(
  cuotas: CuotaAcuerdo[],
  startIdx: number,
  base: BaseRecalculo
): CuotaAcuerdo[] {
  return recalcular(cuotas, startIdx, base);
}
