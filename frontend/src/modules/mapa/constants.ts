import type { Rol } from "@/shared/constants/acl";

/**
 * Quién ve el "Mapa de Impacto" (menú y página).
 * Por ahora solo adminFranquicia, mientras se prueba en producción.
 * Para abrirlo al equipo, agrega aquí los roles: el menú y la página leen esta lista.
 * Ej.: ["admin", "ejecutivo", "ejecutivoAdmin", "supervisor", "dependiente", "abogado", "adminFranquicia"]
 */
export const ROLES_MAPA_CONJUNTOS: Rol[] = ["adminFranquicia"];

/**
 * El mapa solo muestra la franquicia Cundinamarca: Eje Cafetero es de prueba.
 * Si mañana entra otra franquicia real, se vuelve a poner el filtro.
 */
export const FRANQUICIA_MAPA_ID = "LQZ0v6BorErqeO284X86"; // Cundinamarca
