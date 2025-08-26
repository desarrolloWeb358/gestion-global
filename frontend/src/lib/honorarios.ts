// helpers/honorarios.ts
import { Deudor } from "../modules/cobranza/models/deudores.model";
import { EstadoMensual } from "../modules/cobranza/models/estadoMensual.model";

/** Elige el porcentaje: usa el del estado mensual si existe; si no, toma el del deudor; si no, 0 */
export function resolverPorcentajeHonorarios(
  estado: Partial<EstadoMensual> | undefined,
  deudor: Partial<Deudor> | undefined
): number {
  const e = Number(deudor?.porcentajeHonorarios);
  if (!isNaN(e) && e > 0) return e;

  const d = Number(deudor?.porcentajeHonorarios);
  if (!isNaN(d) && d > 0) return d;

  return 0;
}

/**
 * Calcula monto de honorarios y total.
 * - Si el estado trae `porcentajeHonorarios`, lo usa.
 * - Si no, usa `deudor.porcentajeHonorarios` como default.
 */
export function calcularDeudaTotal(
  estadoMensual: Pick<EstadoMensual, "deuda" | "porcentajeHonorarios">,
  deudor?: Pick<Deudor, "porcentajeHonorarios">
): { deuda: number; honorariosCalculados: number; total: number; porcentajeUsado: number } {
  const deuda = Number(estadoMensual.deuda) || 0;
  const porcentajeUsado = resolverPorcentajeHonorarios(estadoMensual, deudor);
  const honorariosCalculados = (deuda * porcentajeUsado) / 100;
  const total = deuda + honorariosCalculados;
  return { deuda, honorariosCalculados, total, porcentajeUsado };
}
