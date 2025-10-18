export const TIPO_SEGUIMIENTO = [
  { code: "llamada",             label: "Llamada" },
  { code: "visita_notificacion", label: "Visita - Notificación" },
  { code: "correo",              label: "Correo" },
  { code: "whatsapp",            label: "Whatsapp" },
  { code: "correo_certificado",  label: "Correo Certificado" },
  { code: "sms",                 label: "Sms" },
  { code: "otro",                label: "Otro" },
] as const;

export type TipoSeguimientoCode = typeof TIPO_SEGUIMIENTO[number]["code"];

export const codeToLabel = Object.fromEntries(
  TIPO_SEGUIMIENTO.map(o => [o.code, o.label])
) as Record<TipoSeguimientoCode, string>;

export const labelToCode = Object.fromEntries(
  TIPO_SEGUIMIENTO.map(o => [o.label, o.code])
) as Record<string, TipoSeguimientoCode>;

export const TIPO_SEGUIMIENTO_VALUES =
  TIPO_SEGUIMIENTO.map(o => o.code) as TipoSeguimientoCode[];