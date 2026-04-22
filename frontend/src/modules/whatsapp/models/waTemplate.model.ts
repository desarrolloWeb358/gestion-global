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
  createdAt: Timestamp;
}
