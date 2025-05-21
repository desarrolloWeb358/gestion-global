// src/modules/cobranza/services/agreementService.ts
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { addMonths, formatISO } from 'date-fns';
import { Agreement } from '../models/Agreement.model';

interface GenerarParams {
  numero: string;
  fechaAcuerdo: string;             // ISO
  caracteristicas: string;
  tipo: 'fijo' | 'variable';        // Tipo de acuerdo
  porcentajeHonorarios: number;     // % honorarios
  deudaCapitalInicial?: number;      // monto capital inicial (opcional)
  valorTotalAcordado?: number;      // alias para deuda capital inicial
  cuotasCount: number;              // número de cuotas
  fechaInicio: string;              // fecha primera cuota
}

/**
 * Genera cronograma basándose en cuota acuerdo distribuida igual y distribuye honorarios según porcentaje
 */
export async function generarYGuardarAcuerdo(
  inmuebleId: string,
  params: GenerarParams
): Promise<void> {
  const ref = doc(db, 'inmuebles', inmuebleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Inmueble no encontrado');

  // Determinar deuda de capital a usar (alias valorTotalAcordado o deudaCapitalInicial)
  const debtCapital = params.deudaCapitalInicial ?? params.valorTotalAcordado!;
  // Cálculo de totales
  const cuotaAcuerdo = Number((debtCapital / params.cuotasCount).toFixed(2));
  const totalHonorarios = Number((debtCapital * params.porcentajeHonorarios / 100).toFixed(2));

  let deudaCapital = params.deudaCapitalInicial ?? 0;
  let deudaHonorarios = totalHonorarios;

  const cuotas: Agreement['cuotas'] = [];

  for (let i = 0; i < params.cuotasCount; i++) {
    const dueDate = addMonths(new Date(params.fechaInicio), i);
    const numero_cuota = i + 1;

    // Honorarios de esta cuota
    const cuota_honorarios = Number((cuotaAcuerdo * params.porcentajeHonorarios / 100).toFixed(2));
    // Capital de esta cuota
    const cuota_capital = Number((cuotaAcuerdo - cuota_honorarios).toFixed(2));

    // Saldo antes de aplicar esta cuota
    const deuda_capital = deudaCapital;
    const deuda_honorarios = deudaHonorarios;

    // Reducir saldos
    deudaCapital = Number((deudaCapital - cuota_capital).toFixed(2));
    deudaHonorarios = Number((deudaHonorarios - cuota_honorarios).toFixed(2));

    // Monto total cuota
    const cuota_acuerdo = Number((cuota_capital + cuota_honorarios).toFixed(2));

    cuotas.push({
      numero_cuota,
      deuda_capital,
      cuota_capital,
      deuda_honorarios,
      cuota_honorarios,
      cuota_acuerdo,
      fecha_limite: formatISO(dueDate, { representation: 'date' }),
      observacion: '',
      pagado: false,
    });
  }

  const acuerdoPago: Agreement = {
    numero: params.numero,
    fecha_acuerdo: params.fechaAcuerdo,
    caracteristicas: params.caracteristicas,
    tipo: params.tipo,
    porcentajeHonorarios: params.porcentajeHonorarios,
    valor_total_acordado: debtCapital,
    cuotas,
  };

  await updateDoc(ref, { acuerdo_pago: acuerdoPago });
}

/**
 * Marca cuota como pagada
 */
export async function marcarCuotaPagada(
  inmuebleId: string,
  indexCuota: number,
  pagoFecha?: string
): Promise<void> {
  const ref = doc(db, 'inmuebles', inmuebleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Inmueble no encontrado');
  const data = snap.data();
  if (!data.acuerdo_pago) throw new Error('No hay acuerdo de pago definido');

  const cuotas = (data.acuerdo_pago.cuotas as Agreement['cuotas']).map((c, idx) =>
    idx === indexCuota
      ? { ...c, pagado: true, observacion: `Pagada el ${pagoFecha || new Date().toISOString()}` }
      : c
  );

  await updateDoc(ref, { 'acuerdo_pago.cuotas': cuotas });
}

/**
 * Actualiza fecha límite de cuota específica
 */
export async function actualizarFechaCuota(
  inmuebleId: string,
  indexCuota: number,
  nuevaFecha: string
): Promise<void> {
  const ref = doc(db, 'inmuebles', inmuebleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Inmueble no encontrado');
  const data = snap.data();
  if (!data.acuerdo_pago) throw new Error('No hay acuerdo de pago definido');

  const cuotas = (data.acuerdo_pago.cuotas as Agreement['cuotas']).map((c, idx) =>
    idx === indexCuota
      ? { ...c, fecha_limite: nuevaFecha }
      : c
  );

  await updateDoc(ref, { 'acuerdo_pago.cuotas': cuotas });
}

/**
 * Actualiza campo numérico (cuota_capital o cuota_honorarios)
 */
export async function actualizarCuotaField(
  inmuebleId: string,
  indexCuota: number,
  field: 'cuota_capital' | 'cuota_honorarios',
  value: number
): Promise<void> {
  const ref = doc(db, 'inmuebles', inmuebleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Inmueble no encontrado');
  const data = snap.data();
  if (!data.acuerdo_pago) throw new Error('No hay acuerdo de pago definido');

  const cuotas = (data.acuerdo_pago.cuotas as Agreement['cuotas']).map((c, idx) =>
    idx === indexCuota
      ? { ...c, [field]: value }
      : c
  );

  await updateDoc(ref, { 'acuerdo_pago.cuotas': cuotas });
}
