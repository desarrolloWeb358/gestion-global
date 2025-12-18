import { Timestamp } from "firebase/firestore";
import type { CuotaAcuerdo, Periodicidad } from "@/modules/cobranza/models/acuerdoPago.model";

type GenerarTablaInput = {
  capitalInicial: number;
  porcentajeHonorarios: number;
  numeroCuotas: number;
  fechaPrimeraCuota: Date;
  periodicidad: Periodicidad;

  // si el ejecutivo define una cuota “base”, se usa; si no, se calcula por total/numCuotas
  valorCuotaBase?: number;

  // opcional: si quiere que la última cuota ajuste redondeos
  ajustarUltimaCuota?: boolean;
};

const addPeriod = (date: Date, periodicidad: Periodicidad) => {
  const d = new Date(date);
  if (periodicidad === "semanal") d.setDate(d.getDate() + 7);
  else if (periodicidad === "quincenal") d.setDate(d.getDate() + 15);
  else d.setMonth(d.getMonth() + 1);
  return d;
};

const roundPesos = (n: number) => Math.round(n); // pesos enteros

export function generarTablaAcuerdo(input: GenerarTablaInput) {
  const {
    capitalInicial,
    porcentajeHonorarios,
    numeroCuotas,
    fechaPrimeraCuota,
    periodicidad,
    valorCuotaBase,
    ajustarUltimaCuota = true,
  } = input;

  const honorariosInicial = capitalInicial * (porcentajeHonorarios / 100);
  const totalAcordado = capitalInicial + honorariosInicial;

  const cuotaBase = valorCuotaBase && valorCuotaBase > 0
    ? valorCuotaBase
    : totalAcordado / numeroCuotas;

  // Distribución proporcional (como tu Excel): honorarios = cuota * (honorariosInicial/totalAcordado)
  const ratioHon = honorariosInicial / totalAcordado;

  const cuotas: CuotaAcuerdo[] = [];
  let fecha = new Date(fechaPrimeraCuota);

  let capSaldo = capitalInicial;
  let honSaldo = honorariosInicial;

  let sumCuotas = 0;
  let sumCap = 0;
  let sumHon = 0;

  for (let i = 0; i < numeroCuotas; i++) {
    const numero = i + 1;

    // cuota provisional
    let valorCuota = cuotaBase;

    // redondeo en pesos (cada fila) para que sea usable
    let honCuota = roundPesos(valorCuota * ratioHon);
    let capCuota = roundPesos(valorCuota - honCuota);

    // evita negativos en saldos por redondeo final
    if (capCuota > capSaldo) capCuota = roundPesos(capSaldo);
    if (honCuota > honSaldo) honCuota = roundPesos(honSaldo);

    valorCuota = roundPesos(capCuota + honCuota);

    const cuota: CuotaAcuerdo = {
      numero,
      fechaVencimiento: Timestamp.fromDate(fecha),

      valorCuota,
      capitalCuota: capCuota,
      honorariosCuota: honCuota,

      capitalSaldoAntes: roundPesos(capSaldo),
      capitalSaldoDespues: roundPesos(capSaldo - capCuota),

      honorariosSaldoAntes: roundPesos(honSaldo),
      honorariosSaldoDespues: roundPesos(honSaldo - honCuota),

      estado: "pendiente",
      observacion: "",
    };

    cuotas.push(cuota);

    capSaldo = capSaldo - capCuota;
    honSaldo = honSaldo - honCuota;

    sumCuotas += valorCuota;
    sumCap += capCuota;
    sumHon += honCuota;

    fecha = addPeriod(fecha, periodicidad);
  }

  // Ajuste de última cuota para cerrar EXACTO (si hay redondeos)
  if (ajustarUltimaCuota && cuotas.length > 0) {
    const last = cuotas[cuotas.length - 1];

    const deltaCap = roundPesos(capitalInicial - sumCap);
    const deltaHon = roundPesos(honorariosInicial - sumHon);

    if (deltaCap !== 0 || deltaHon !== 0) {
      // Reajusta contra saldos “antes” del last para que no se vaya negativo
      const capNuevo = roundPesos(last.capitalCuota + deltaCap);
      const honNuevo = roundPesos(last.honorariosCuota + deltaHon);

      last.capitalCuota = Math.max(0, capNuevo);
      last.honorariosCuota = Math.max(0, honNuevo);
      last.valorCuota = roundPesos(last.capitalCuota + last.honorariosCuota);

      last.capitalSaldoDespues = roundPesos(last.capitalSaldoAntes - last.capitalCuota);
      last.honorariosSaldoDespues = roundPesos(last.honorariosSaldoAntes - last.honorariosCuota);
    }
  }

  return {
    capitalInicial: roundPesos(capitalInicial),
    honorariosInicial: roundPesos(honorariosInicial),
    totalAcordado: roundPesos(totalAcordado),
    cuotas,
  };
}
