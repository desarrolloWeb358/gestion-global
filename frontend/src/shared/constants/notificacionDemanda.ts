// Tipos de notificación de un demandado dentro de una demanda.
// Los nombres reales aún están por definir; se dejan como tipo1/tipo2/tipo3
// y solo hay que cambiar los `label` cuando el negocio los confirme.
export enum TipoNotificacionDemanda {
  TIPO1 = "tipo1",
  TIPO2 = "tipo2",
  TIPO3 = "tipo3",
}

export const TIPOS_NOTIFICACION_DEMANDA: {
  value: TipoNotificacionDemanda;
  label: string;
}[] = [
  { value: TipoNotificacionDemanda.TIPO1, label: "291" },
  { value: TipoNotificacionDemanda.TIPO2, label: "292" },
  { value: TipoNotificacionDemanda.TIPO3, label: "2213" },
];

export function labelTipoNotificacion(value?: string): string {
  const found = TIPOS_NOTIFICACION_DEMANDA.find((t) => t.value === value);
  return found ? found.label : value ?? "—";
}
