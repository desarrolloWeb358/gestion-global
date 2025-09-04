// src/shared/constants/acl.ts

// --- ROLES (únicos y tipados) ---
export const ROLES = ["admin", "ejecutivo", "cliente", "abogado", "deudor"] as const;
export type Rol = typeof ROLES[number];

// Prioridad cuando alguien tiene varios roles (elige su "home")
export const ROL_PRIORITY: Rol[] = ["admin", "ejecutivo", "abogado", "cliente", "deudor"];

// Home por rol (ajusta más adelante si deudor tiene su propia pantalla)
export const DEFAULT_HOME = "/dashboard/cliente" as const;

export const ROLE_HOME: Record<Rol, string> = {
  admin:     "/dashboard/admin",
  ejecutivo: "/dashboard/ejecutivo",
  abogado:   "/dashboard/abogado",
  cliente:   "/dashboard/cliente",
  deudor:    "/dashboard/deudor",
};

// --- PERMISOS (scopes) ---
export const PERMS = {
  Usuarios_Read: "usuarios.read",
  Usuarios_Create: "usuarios.create",

  Clientes_Read: "clientes.read",
  Clientes_Edit: "clientes.edit",

  Deudores_Read: "deudores.read",
  Deudores_Edit: "deudores.edit",
  Deudores_Obs_Create: "deudores.observaciones.create",

  Valores_Read: "valores.read",
} as const;

export type Perm = typeof PERMS[keyof typeof PERMS];

// Mapa rol → permisos (ajústalo a tu negocio)
export const ROLE_PERMISSIONS: Record<Rol, readonly (typeof PERMS)[keyof typeof PERMS][]> = {
  admin: [
    PERMS.Usuarios_Read, PERMS.Usuarios_Create,
    PERMS.Clientes_Read, PERMS.Clientes_Edit,
    PERMS.Deudores_Read, PERMS.Deudores_Edit, PERMS.Deudores_Obs_Create,
    PERMS.Valores_Read,
  ],
  ejecutivo: [
    PERMS.Clientes_Read, PERMS.Clientes_Edit,
    PERMS.Deudores_Read, PERMS.Deudores_Edit, PERMS.Deudores_Obs_Create,
  ],
  cliente: [
    PERMS.Clientes_Read,
    PERMS.Deudores_Read,
    PERMS.Deudores_Obs_Create,
  ],
  abogado: [
    PERMS.Valores_Read,
    PERMS.Clientes_Read, PERMS.Deudores_Read,
  ],
  deudor: [
    PERMS.Deudores_Read, // mínimo; amplía si tu portal de deudor lo requiere
  ],
};

// (Opcional) runtime guard para limpiar roles que vengan de Firestore mal escritos
export function sanitizeRoles(input: unknown): Rol[] {
  if (!Array.isArray(input)) return [];
  return input.filter((r): r is Rol => ROLES.includes(r as Rol));
}
