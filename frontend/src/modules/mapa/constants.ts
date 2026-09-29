import type { Rol } from "@/shared/constants/acl";

/**
 * Quién ve el "Mapa de conjuntos" (menú y página).
 * Por ahora solo adminFranquicia, mientras se prueba en producción.
 * Para abrirlo al equipo, agrega aquí los roles: el menú y la página leen esta lista.
 * Ej.: ["admin", "ejecutivo", "ejecutivoAdmin", "supervisor", "dependiente", "abogado", "adminFranquicia"]
 */
export const ROLES_MAPA_CONJUNTOS: Rol[] = ["adminFranquicia"];
