import type { CuotaAcuerdo } from "@/modules/cobranza/models/acuerdoPago.model";

const round = (x: number) => Math.round(x);
const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

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
 * Recalcula TODA la tabla (y ahora SÍ recorta filas sobrantes en 0 al final).
 */
export function recalcularTablaDesdeValorCuota(
  cuotas: CuotaAcuerdo[],
  base: { capitalInicial: number; porcentajeHonorarios: number }
): CuotaAcuerdo[] {
  const cap0 = round(n(base.capitalInicial));
  const porcentaje = n(base.porcentajeHonorarios);

  let capSaldo = cap0;
  let honSaldo = round(cap0 * (porcentaje / 100));

  const out: CuotaAcuerdo[] = [];

  for (let i = 0; i < cuotas.length; i++) {
    const r = buildRow(cuotas[i], i, porcentaje, capSaldo, honSaldo);
    out.push(r.row);
    capSaldo = r.capSaldo;
    honSaldo = r.honSaldo;
  }

  // ✅ AQUÍ: recorta filas finales en 0
  return trimTrailingZeroRows(out);
}

/**
 * Recalcula DESDE una fila hacia abajo (y ahora SÍ recorta filas sobrantes en 0 al final).
 */
export function recalcularTablaDesdeValorCuotaDesdeIndice(
  cuotas: CuotaAcuerdo[],
  startIdx: number,
  base: { capitalInicial: number; porcentajeHonorarios: number }
): CuotaAcuerdo[] {
  if (startIdx <= 0) return recalcularTablaDesdeValorCuota(cuotas, base);

  const porcentaje = n(base.porcentajeHonorarios);

  // recalculamos todo hasta startIdx-1 para obtener saldos correctos
  const prefix = recalcularTablaDesdeValorCuota(cuotas.slice(0, startIdx), base);
  const lastPrefix = prefix[prefix.length - 1];

  let capSaldo = round(n(lastPrefix?.capitalSaldoDespues ?? 0));
  let honSaldo = round(n(lastPrefix?.honorariosSaldoDespues ?? 0));

  const out: CuotaAcuerdo[] = [...prefix];

  for (let i = startIdx; i < cuotas.length; i++) {
    const r = buildRow(cuotas[i], i, porcentaje, capSaldo, honSaldo);
    out.push(r.row);
    capSaldo = r.capSaldo;
    honSaldo = r.honSaldo;
  }

  // ✅ AQUÍ: recorta filas finales en 0
  return trimTrailingZeroRows(out);
}
