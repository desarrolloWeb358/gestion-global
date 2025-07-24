import { deudor } from "../modules/cobranza/models/deudores.model";

export function useClienteResumen(clienteId: string, inmuebles: deudor[]) {
  const inmueblesCliente = inmuebles.filter(i => i.clienteId === clienteId);

  const deudaTotal = inmueblesCliente.reduce((sum, i) => sum + i.deuda_total, 0);

  const totalRecaudado = inmueblesCliente.reduce((sum, i) => {
    const total = Object.values(i.recaudos ?? {}).reduce((m, r) => m + r.monto, 0);
    return sum + total;
  }, 0);

  const porcentajeRecuperado = deudaTotal > 0
    ? Math.min((totalRecaudado / deudaTotal) * 100, 100)
    : 0;

  return {
    inmueblesCliente,
    deudaTotal,
    totalRecaudado,
    porcentajeRecuperado,
  };
}
