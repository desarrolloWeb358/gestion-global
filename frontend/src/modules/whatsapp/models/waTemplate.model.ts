import type { Timestamp } from "firebase/firestore";

export interface WaTemplateVariable {
  name: string;
}

export interface WaTemplate {
  id: string;
  numberId: string;
  displayName: string;           // Nombre amigable para mostrar en UI
  providerTemplateName: string;  // Nombre exacto en Meta Business Suite
  bodyText: string;              // Cuerpo con {{variable}} placeholders
  variables: WaTemplateVariable[];
  /**
   * Tipo de encabezado aprobado en Meta. "image" obliga a adjuntar una imagen
   * en cada envio: Meta rechaza la plantilla si el header queda sin parametro.
   * Ausente = plantilla sin encabezado (comportamiento historico).
   */
  headerType?: "none" | "image";
  createdAt: Timestamp;
}
