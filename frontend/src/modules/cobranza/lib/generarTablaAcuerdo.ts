import { Timestamp } from "firebase/firestore";
import type { CuotaAcuerdo } from "@/modules/cobranza/models/acuerdoPago.model";

type Input = {
  capitalInicial: number;
  porcentajeHonorarios: number; // default 15
  fechaPrimeraCuota: Date;
  valorCuotaBase: number;       // OBLIGATORIA
  maxMeses?: number;            // opcional “freno” por seguridad (por ejemplo 240)
};

const round = (n: number) => Math.round(n);

const addMonths = (d: Date, months: number) => {
  const x = new Date(d);
  const day = x.getDate();
  x.setMonth(x.getMonth() + months);

  // evita saltos raros (31 -> feb)
  if (x.getDate() < day) x.setDate(0);
  return x;
};

export const generarTablaAcuerdo = ({
  capitalInicial,
  porcentajeHonorarios,
  fechaPrimeraCuota,
  valorCuotaBase,
  maxMeses = 240,
}: Input): { cuotas: CuotaAcuerdo[]; honorariosInicial: number; totalAcordado: number } => {
  const cap0 = round(capitalInicial);
  const hon0 = round(capitalInicial * (porcentajeHonorarios / 100));
  const total = round(cap0 + hon0);

  let capSaldo = cap0;
  let honSaldo = hon0;

  const cuotaBase = round(valorCuotaBase);
  const cuotaHonTeorica = round(cuotaBase * (porcentajeHonorarios / 100));

  const cuotas: CuotaAcuerdo[] = [];

  let i = 0;
  while ((capSaldo > 0 || honSaldo > 0) && i < maxMeses) {
    const numero = i + 1;
    const fecha = addMonths(fechaPrimeraCuota, i);

    const honorariosAntes = honSaldo;
    const capitalAntes = capSaldo;

    // 1) honorarios: se cobra hasta donde alcance (prioridad)
    const honorariosCuota = honSaldo > 0 ? Math.min(honSaldo, cuotaHonTeorica) : 0;

    // 2) el resto de la cuota va a capital
    let capitalCuota = cuotaBase - honorariosCuota;

    // si capital ya está en 0, no seguimos “forzando” capital
    if (capSaldo <= 0) capitalCuota = 0;

    // no cobrar más capital del que falta
    if (capitalCuota > capSaldo) capitalCuota = capSaldo;

    // si ya no hay nada por cobrar, salimos
    const valorCuota = honorariosCuota + capitalCuota;
    if (valorCuota <= 0) break;

    honSaldo = round(honSaldo - honorariosCuota);
    capSaldo = round(capSaldo - capitalCuota);

    cuotas.push({
      numero,
      fechaPago: Timestamp.fromDate(fecha),
      valorCuota: round(valorCuota),
      honorariosCuota: round(honorariosCuota),
      capitalCuota: round(capitalCuota),

      honorariosSaldoAntes: round(honorariosAntes),
      honorariosSaldoDespues: round(honSaldo),
      capitalSaldoAntes: round(capitalAntes),
      capitalSaldoDespues: round(capSaldo),

      pagado: false,
    });

    i++;
  }

  // Ajuste final: si quedó saldo por rounding raro, lo absorbemos en la última cuota
  // (esto evita terminar con 1 peso pendiente por redondeos)
  if (cuotas.length && (capSaldo !== 0 || honSaldo !== 0)) {
    const last = cuotas[cuotas.length - 1];
    const honExtra = Math.max(0, honSaldo);
    const capExtra = Math.max(0, capSaldo);

    last.honorariosCuota = round(last.honorariosCuota + honExtra);
    last.capitalCuota = round(last.capitalCuota + capExtra);
    last.valorCuota = round(last.honorariosCuota + last.capitalCuota);

    last.honorariosSaldoDespues = 0;
    last.capitalSaldoDespues = 0;
  }

  return { cuotas, honorariosInicial: hon0, totalAcordado: total };
};
