// src/modules/cobranza/services/reportes/porRecuperar.ts

/** Fila de estadosMensuales ya filtrada al año y al rango de meses consultado. */
export interface EstadoMensualPorRecuperar {
  mes: string; // "YYYY-MM"
  deuda?: number;
  recaudo?: number;
  honorariosDeuda?: number;
}

/**
 * "Por recuperar" = saldo vigente del deudor.
 *
 * La deuda NO es acumulativa y no se registra todos los meses: cuando no se
 * conoce, la fila queda con deuda = 0 (el input masivo guarda el campo vacío
 * como 0). Por eso el saldo parte de la ÚLTIMA deuda conocida (deuda != 0) y
 * se le descuentan los recaudos de ese mes EN ADELANTE — los recaudos previos
 * ya están reflejados en ese corte.
 *
 * Si los recaudos posteriores superan la última deuda conocida, el saldo queda
 * en 0: la deuda cero es un estado derivado, nunca registrado.
 *
 * Recibe los estados YA filtrados por año y por mes de corte.
 */
export function calcularPorRecuperar(estados: EstadoMensualPorRecuperar[]): number {
  let ultimoMesConDeuda: string | null = null;
  let deudaConHonorarios = 0;

  for (const e of estados) {
    const d = Number(e.deuda ?? 0);
    if (!Number.isFinite(d) || d === 0) continue;

    if (!ultimoMesConDeuda || e.mes > ultimoMesConDeuda) {
      ultimoMesConDeuda = e.mes;
      const honDeuda = Number(e.honorariosDeuda ?? 0);
      deudaConHonorarios = d + (Number.isFinite(honDeuda) ? honDeuda : 0);
    }
  }

  if (!ultimoMesConDeuda) return 0;

  let recaudoDesdeUltimaDeuda = 0;
  for (const e of estados) {
    if (e.mes < ultimoMesConDeuda) continue;
    const r = Number(e.recaudo ?? 0);
    if (Number.isFinite(r)) recaudoDesdeUltimaDeuda += r;
  }

  return Math.max(0, deudaConHonorarios - recaudoDesdeUltimaDeuda);
}
