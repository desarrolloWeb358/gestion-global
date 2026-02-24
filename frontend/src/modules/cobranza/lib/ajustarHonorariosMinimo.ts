import type { CuotaAcuerdo } from "@/modules/cobranza/models/acuerdoPago.model";

// Regla negocio (único lugar donde cambias el umbral)
const MIN_HONORARIOS_ULTIMA_CUOTA = 20000;

export function ajustarUltimaCuotaHonorariosMinimo(
  cuotas: CuotaAcuerdo[]
): CuotaAcuerdo[] {
  if (!Array.isArray(cuotas) || cuotas.length < 2) return cuotas;

  // 1) encontrar "la última cuota" que realmente tiene honorarios (>0)
  let lastIdx = -1;
  for (let i = cuotas.length - 1; i >= 0; i--) {
    const hon = Math.round(Number(cuotas[i]?.honorariosCuota || 0));
    if (hon > 0) {
      lastIdx = i;
      break;
    }
  }

  // si no hay honorarios en ninguna fila, no hay nada que ajustar
  if (lastIdx === -1) return cuotas;

  // si es la primera fila, no hay anterior para sumarle
  const prevIdx = lastIdx - 1;
  if (prevIdx < 0) return cuotas;

  const lastHon = Math.round(Number(cuotas[lastIdx]?.honorariosCuota || 0));

  // Si ya cumple mínimo, no hacer nada
  if (lastHon >= MIN_HONORARIOS_ULTIMA_CUOTA) return cuotas;

  const next = cuotas.map((c) => ({ ...c }));

  const prevCap = Math.round(Number(next[prevIdx].capitalCuota || 0));
  const prevHon = Math.round(Number(next[prevIdx].honorariosCuota || 0));

  const lastCap = Math.round(Number(next[lastIdx].capitalCuota || 0));
  const lastHonCurr = Math.round(Number(next[lastIdx].honorariosCuota || 0)); // lastHon

  // mover honorarios pequeños a la cuota anterior,
  // manteniendo valorCuota fijo (compensas ajustando capitalCuota)
  const mover = Math.min(lastHonCurr, prevCap);
  if (mover <= 0) return cuotas;

  // --- cuota anterior: honorarios suben, capital baja ---
  next[prevIdx].honorariosCuota = prevHon + mover;
  next[prevIdx].capitalCuota = prevCap - mover;

  // --- cuota "última con honorarios": honorarios bajan, capital sube ---
  next[lastIdx].honorariosCuota = lastHonCurr - mover; // normalmente queda 0
  next[lastIdx].capitalCuota = lastCap + mover;

  return next;
}