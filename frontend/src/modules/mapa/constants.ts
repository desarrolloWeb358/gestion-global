import type { Rol } from "@/shared/constants/acl";

/**
 * Quién ve el "Mapa de Impacto" (menú y página): todo el equipo interno.
 * Quedan fuera los roles externos (cliente, clienteCaso y deudor): el mapa
 * muestra la cartera de TODOS los conjuntos.
 * Corregir un pin además pide PERMS.Clientes_Edit (abogado y adminFranquicia no lo tienen).
 */
export const ROLES_MAPA_CONJUNTOS: Rol[] = [
  "admin",
  "supervisor",
  "adminFranquicia",
  "ejecutivo",
  "ejecutivoAdmin",
  "dependiente",
  "abogado",
];

/**
 * El mapa solo muestra la franquicia Cundinamarca: Eje Cafetero es de prueba.
 * Si mañana entra otra franquicia real, se vuelve a poner el filtro.
 */
export const FRANQUICIA_MAPA_ID = "LQZ0v6BorErqeO284X86"; // Cundinamarca
