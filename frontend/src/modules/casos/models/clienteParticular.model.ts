// modules/casos/models/clienteParticular.model.ts
//
// Segunda línea de negocio: clientes (persona natural o jurídica) a los que
// Gestión Global les lleva CASOS, no cartera. Viven en la colección raíz
// `clientesParticulares`, totalmente independiente de `clientes` (conjuntos).
//
// El id del documento es el UID del usuario, igual que en `clientes/{uid}`:
// el cliente siempre se crea desde Usuarios asignando el rol `clienteCaso`.
import type { FechaFirestore } from "@/modules/cobranza/models/demanda.model";

export type TipoPersona = "natural" | "juridica";

export interface ClienteParticular {
  /** = id del documento = uid del usuario con rol `clienteCaso` */
  id?: string;

  tipoPersona: TipoPersona;
  nombre: string;
  tipoDocumento?: "CC" | "CE" | "TI" | "NIT";
  numeroDocumento?: string;
  /** Solo aplica a personas jurídicas */
  representanteLegal?: string;

  correos: string[];
  telefonos: string[];
  direccion?: string;

  // Misma dimensión organizacional que `clientes`
  franquiciaId?: string;
  ciudad?: string;

  // Equipo responsable: se asigna a nivel de cliente y los casos lo heredan.
  abogadoId?: string | null;
  dependienteId?: string | null;

  activo?: boolean;
  fechaCreacion?: FechaFirestore;
  fechaActualizacion?: FechaFirestore;
}

export function etiquetaTipoPersona(t?: TipoPersona): string {
  return t === "juridica" ? "Persona jurídica" : "Persona natural";
}
