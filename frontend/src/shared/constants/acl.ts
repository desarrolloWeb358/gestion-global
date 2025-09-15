// src/shared/constants/acl.ts

// --- ROLES (únicos y tipados) ---
export const ROLES = [
  "admin",
  "ejecutivo",
  "cliente",
  "abogado",
  "deudor",
] as const;
export type Rol = (typeof ROLES)[number];

// Prioridad cuando alguien tiene varios roles (elige su "home")
export const ROL_PRIORITY: Rol[] = [
  "admin",
  "ejecutivo",
  "abogado",
  "cliente",
  "deudor",
];

// Home por rol (ajusta más adelante si deudor tiene su propia pantalla)
export const DEFAULT_HOME = "/dashboard/cliente" as const;

export const ROLE_HOME: Record<Rol, string> = {
  admin: "/dashboard/admin",
  ejecutivo: "/dashboard/ejecutivo",
  abogado: "/dashboard/abogado",
  cliente: "/dashboard/cliente",
  deudor: "/dashboard/deudor",
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

  // Seguimientos / Abonos
  Seguimientos_Read: "seguimientos.read",
  Seguimientos_Edit: "seguimientos.edit",
  Abonos_Read: "abonos.read",
  Abonos_Edit: "abonos.edit",
} as const;
export type Perm = (typeof PERMS)[keyof typeof PERMS];

// Mapa rol → permisos (ajústalo a tu negocio)
export const ROLE_PERMISSIONS: Record<Rol, readonly Perm[]> = {
  admin: [
    PERMS.Usuarios_Read,
    PERMS.Usuarios_Create,

    PERMS.Clientes_Read,
    PERMS.Clientes_Edit,

    PERMS.Deudores_Read,
    PERMS.Deudores_Edit,
    PERMS.Deudores_Obs_Create,

    PERMS.Valores_Read,

    // ✅ Admin puede todo en Seguimientos/Abonos
    PERMS.Seguimientos_Read,
    PERMS.Seguimientos_Edit,
    PERMS.Abonos_Read,
    PERMS.Abonos_Edit,
  ],
  ejecutivo: [
    PERMS.Clientes_Read,
    PERMS.Clientes_Edit,

    PERMS.Deudores_Read,
    PERMS.Deudores_Edit,
    PERMS.Deudores_Obs_Create,

    // ✅ Ejecutivo puede todo en Seguimientos/Abonos
    PERMS.Seguimientos_Read,
    PERMS.Seguimientos_Edit,
    PERMS.Abonos_Read,
    PERMS.Abonos_Edit,
  ],
  cliente: [
    PERMS.Clientes_Read,
    PERMS.Deudores_Read,
    PERMS.Deudores_Obs_Create, // si no debe crear obs, quítalo

    // ✅ Cliente solo lectura en Seguimientos/Abonos
    PERMS.Seguimientos_Read,
    PERMS.Abonos_Read,
  ],
  abogado: [
    PERMS.Valores_Read,
    PERMS.Clientes_Read,
    PERMS.Deudores_Read,

    // 📎 Abogado: lectura (ajusta si necesita editar)
    PERMS.Seguimientos_Read,
    PERMS.Abonos_Read,
  ],
  deudor: [
    PERMS.Deudores_Read, // amplía si aplica a tu portal de deudor
    // p.ej. PERMS.Seguimientos_Read, PERMS.Abonos_Read si procede
  ],
};

// helper opcional (si no lo tienes ya)
export type CanFn = (required: Perm | Perm[]) => boolean;
export function crudMode(can: CanFn, p: { view: Perm; edit: Perm }) {
  if (can(p.edit)) return "rw" as const;
  if (can(p.view)) return "ro" as const;
  return "none" as const;
}

// (Opcional) runtime guard para limpiar roles que vengan de Firestore mal escritos
export function sanitizeRoles(input: unknown): Rol[] {
  if (!Array.isArray(input)) return [];
  return input.filter((r): r is Rol => ROLES.includes(r as Rol));
}
