import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";

export const tipificacionColorMap: Record<TipificacionDeuda, string> = {
  [TipificacionDeuda.GESTIONANDO]: "bg-blue-100 text-blue-800 border-blue-200",
  [TipificacionDeuda.ACUERDO]: "bg-emerald-100 text-emerald-800 border-emerald-200",

  [TipificacionDeuda.DEMANDA]: "bg-red-100 text-red-800 border-red-200",
  [TipificacionDeuda.DEMANDA_ACUERDO]: "bg-orange-100 text-orange-800 border-orange-200",
  [TipificacionDeuda.DEMANDA_TERMINADO]: "bg-purple-100 text-purple-800 border-purple-200",

  [TipificacionDeuda.TERMINADO]: "bg-gray-200 text-gray-800 border-gray-300",
  [TipificacionDeuda.DEVUELTO]: "bg-yellow-100 text-yellow-800 border-yellow-200",

  [TipificacionDeuda.PREJURIDICO_INSOLVENCIA]: "bg-amber-100 text-amber-800 border-amber-200",
  [TipificacionDeuda.DEMANDA_INSOLVENCIA]: "bg-rose-100 text-rose-800 border-rose-200",

  [TipificacionDeuda.INACTIVO]: "bg-slate-200 text-slate-700 border-slate-300",
};
