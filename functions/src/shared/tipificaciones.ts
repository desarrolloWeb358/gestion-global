/**
 * Tipificaciones que corresponden a la etapa jurídica del cobro.
 *
 * Los valores deben coincidir EXACTAMENTE con el enum `TipificacionDeuda`
 * del frontend (`frontend/src/shared/constants/tipificacionDeuda.ts`).
 * Antes cada handler tenía su propia copia del set y la del módulo de correos
 * decía "Demanda terminada" en vez de "Demanda/Terminado", así que los correos
 * a esos deudores quedaban registrados en `seguimiento` y el abogado no los veía.
 */
export const TIPS_JURIDICO = new Set<string>([
  "Demanda",
  "Demanda/Acuerdo",
  "Demanda/Terminado",
  "Demanda/Insolvencia",
]);

/** Colección de seguimiento que le corresponde a una tipificación. */
export function coleccionSeguimiento(tipificacion?: string | null): "seguimiento" | "seguimientoJuridico" {
  return TIPS_JURIDICO.has((tipificacion ?? "").trim()) ? "seguimientoJuridico" : "seguimiento";
}
