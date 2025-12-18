export const ACUERDO_ESTADO = {
  BORRADOR: "BORRADOR",
  EN_FIRME: "EN_FIRME",
  INCUMPLIDO: "INCUMPLIDO",
  CERRADO: "CERRADO",
} as const;

export type EstadoAcuerdo =
  typeof ACUERDO_ESTADO[keyof typeof ACUERDO_ESTADO];

// Normaliza datos viejos en Firestore (borrador, activo, etc.)
export function normalizarEstadoAcuerdo(value: any): EstadoAcuerdo {
  if (!value) return ACUERDO_ESTADO.BORRADOR;

  const v = String(value).toUpperCase();

  switch (v) {
    case "BORRADOR":
      return ACUERDO_ESTADO.BORRADOR;
    case "EN_FIRME":
    case "ACTIVO":
      return ACUERDO_ESTADO.EN_FIRME;
    case "INCUMPLIDO":
      return ACUERDO_ESTADO.INCUMPLIDO;
    case "CERRADO":
    case "CANCELADO":
    case "CUMPLIDO":
      return ACUERDO_ESTADO.CERRADO;
    default:
      return ACUERDO_ESTADO.BORRADOR;
  }
}
