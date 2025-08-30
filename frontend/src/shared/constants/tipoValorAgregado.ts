export enum TipoValorAgregado {
  DERECHO_DE_PETICION = "derecho de peticion",
  TUTELA = "tutela",
  DESACATO = "desacato",
  ESTUDIOS_CONTRATOS = "estudios contratos",
}

// Etiquetas legibles (por si quieres mostrar otro texto)
export const TipoValorAgregadoLabels: Record<TipoValorAgregado, string> = {
  [TipoValorAgregado.DERECHO_DE_PETICION]: "Derecho de Petición",
  [TipoValorAgregado.TUTELA]: "Tutela",
  [TipoValorAgregado.DESACATO]: "Desacato",
  [TipoValorAgregado.ESTUDIOS_CONTRATOS]: "Estudios / Contratos",
};
