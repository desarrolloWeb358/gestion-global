// src/services/agreementService.ts
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';

/**
 * Guarda un nuevo acuerdo de pago completo con cuotas generadas.
 */
export async function generarYGuardarAcuerdo(
  clienteId: string,
  inmuebleId: string,
  data: {
    numero: string;
    fechaAcuerdo: string;
    caracteristicas: string;
    tipo: string;
    porcentajeHonorarios: number;
    deudaCapitalInicial: number;
    cuotasCount: number;
    fechaInicio: string;
  }
): Promise<void> {
  const cuotas = Array.from({ length: data.cuotasCount }, (_, i) => ({
    numero_cuota: i + 1,
    fecha_limite: data.fechaInicio,
    deuda_capital: data.deudaCapitalInicial,
    cuota_capital: 0,
    deuda_honorarios: 0,
    cuota_honorarios: 0,
    cuota_acuerdo: 0,
    pagado: false,
  }));

  const ref = doc(db, `clientes/${clienteId}/inmuebles/${inmuebleId}`);
  await updateDoc(ref, {
    acuerdo_pago: {
      numero: data.numero,
      fecha_acuerdo: data.fechaAcuerdo,
      caracteristicas: data.caracteristicas,
      tipo: data.tipo,
      porcentajeHonorarios: data.porcentajeHonorarios,
      valor_total_acordado: data.deudaCapitalInicial,
      cuotas,
    },
  });
}

/**
 * Actualiza la fecha de pago de una cuota específica.
 */
export async function actualizarFechaCuota(
  clienteId: string,
  inmuebleId: string,
  cuotaIndex: number,
  nuevaFecha: string
): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/inmuebles/${inmuebleId}`);
  await updateDoc(ref, {
    [`acuerdo_pago.cuotas.${cuotaIndex}.fecha_limite`]: nuevaFecha,
  });
}

/**
 * Actualiza un campo específico de una cuota.
 */
export async function actualizarCuotaField(
  clienteId: string,
  inmuebleId: string,
  cuotaIndex: number,
  field: string,
  valor: number
): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/inmuebles/${inmuebleId}`);
  await updateDoc(ref, {
    [`acuerdo_pago.cuotas.${cuotaIndex}.${field}`]: valor,
  });
}

/**
 * Marca como pagada una cuota.
 */
export async function marcarCuotaPagada(
  clienteId: string,
  inmuebleId: string,
  cuotaIndex: number
): Promise<void> {
  const ref = doc(db, `clientes/${clienteId}/inmuebles/${inmuebleId}`);
  await updateDoc(ref, {
    [`acuerdo_pago.cuotas.${cuotaIndex}.pagado`]: true,
  });
}
