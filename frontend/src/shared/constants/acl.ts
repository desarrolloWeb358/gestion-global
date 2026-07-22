export const ROLES = [
  "admin",
  "supervisor",
  "adminFranquicia",
  "ejecutivo",
  "ejecutivoAdmin",
  "dependiente",
  "cliente",
  "abogado",
  "deudor",
] as const;
export type Rol = (typeof ROLES)[number];

// Prioridad cuando alguien tiene varios roles (elige su "home")
export const ROL_PRIORITY: Rol[] = [
  "admin",
  "supervisor",
  "adminFranquicia",
  "ejecutivoAdmin",
  "ejecutivo",
  "dependiente",
  "abogado",
  "cliente",
  "deudor",
];

// Home por rol
export const DEFAULT_HOME = "/dashboard/cliente" as const;

export const ROLE_HOME: Record<Rol, string> = {
  admin: "/dashboard/admin",
  supervisor: "/dashboard/ejecutivo",
  adminFranquicia: "/clientes-tables",
  ejecutivoAdmin: "/dashboard/ejecutivo",
  ejecutivo: "/dashboard/ejecutivo",
  dependiente: "/clientes-tables",
  abogado: "/dashboard/abogado",
  cliente: "/dashboard/cliente",
  deudor: "/dashboard/deudor",
};

// --- PERMISOS (scopes) ---
export const PERMS = {

  Admin_Read: "admin.read",

  Usuarios_Read: "usuarios.read",
  Usuarios_Create: "usuarios.create",

  Clientes_Read: "clientes.read",
  Clientes_Edit: "clientes.edit",

  Deudores_Read: "deudores.read",
  Deudores_Edit: "deudores.edit",
  //Deudores_Obs_Create: "deudores.observaciones.create", 

  // Valores Agregados
  Valores_Read: "valores.read",
  Valores_Obs_Create: "valores.observaciones.create", 

  // Seguimientos Ejecutivos
  Seguimientos_Ejecutivos_Read: "seguimientos.ejecutivos.read",
  Seguimientos_Ejecutivos_Edit: "seguimientos.ejecutivos.edit",

  // Seguimientos Dependientes
  Seguimientos_Dependientes_Read: "seguimientos.dependientes.read",
  Seguimientos_Dependientes_Edit: "seguimientos.dependientes.edit",

  Seguimientos_Observaciones_Create: "seguimientos.observaciones.create",

  // Abonos
  Abonos_Read: "abonos.read",
  Abonos_Edit: "abonos.edit",

  //"Recaudos y Deudas"
  Recaudos_Read: "recaudos.read",

  // Valores agregados 
  Valores_agregados_Read: "valoresAgregados.read",
  Valores_agregados_Edit: "valoresAgregados.edit",

  ReporteCliente_Download_Word: "reporteCliente.download.word",
  ReporteCliente_Download_Pdf: "reporteCliente.download.pdf",

  RegistrosEliminados_Read: "registrosEliminados.read",

  // Contratos
  Contratos_Read: "contratos.read",
  Contratos_Edit: "contratos.edit",

  // WhatsApp
  Whatsapp_Read:  "whatsapp.read",
  Whatsapp_Write: "whatsapp.write",

  // Seguimiento — edición de fecha (solo ejecutivoAdmin y admin)
  Seguimientos_Fecha_Edit: "seguimientos.fecha.edit",

  // Tareas
  Tareas_Read: "tareas.read",
  Tareas_Assign: "tareas.assign",
  Tareas_Manage: "tareas.manage",
  Tareas_Estado_Edit: "tareas.estado.edit",
} as const;
export type Perm = (typeof PERMS)[keyof typeof PERMS];

// Mapa rol → permisos
export const ROLE_PERMISSIONS: Record<Rol, readonly Perm[]> = {
  admin: [
    PERMS.Admin_Read,
    PERMS.Usuarios_Read,
    PERMS.Usuarios_Create,
    PERMS.Clientes_Read,
    PERMS.Clientes_Edit,
    PERMS.Deudores_Read,
    PERMS.Deudores_Edit,
    PERMS.Valores_Read,
    PERMS.Seguimientos_Ejecutivos_Read,
    PERMS.Seguimientos_Ejecutivos_Edit,
    PERMS.Seguimientos_Dependientes_Read,
    PERMS.Seguimientos_Dependientes_Edit,
    PERMS.Seguimientos_Fecha_Edit,
    PERMS.Abonos_Read,
    PERMS.Abonos_Edit,
    PERMS.Recaudos_Read,
    PERMS.Valores_agregados_Read,
    PERMS.Valores_agregados_Edit,
    PERMS.ReporteCliente_Download_Word,
    PERMS.RegistrosEliminados_Read,
    PERMS.Contratos_Read,
    PERMS.Contratos_Edit,
    PERMS.Whatsapp_Read,
    PERMS.Whatsapp_Write,
    PERMS.Tareas_Read,
    PERMS.Tareas_Assign,
    PERMS.Tareas_Manage,
  ],

  supervisor: [
    PERMS.Usuarios_Read,
    PERMS.Usuarios_Create,
    PERMS.Clientes_Read,
    PERMS.Clientes_Edit,
    PERMS.Deudores_Read,
    PERMS.Deudores_Edit,
    PERMS.Seguimientos_Ejecutivos_Read,
    PERMS.Seguimientos_Ejecutivos_Edit,
    PERMS.Seguimientos_Dependientes_Read,
    PERMS.Seguimientos_Dependientes_Edit,
    PERMS.Abonos_Read,
    PERMS.Abonos_Edit,
    PERMS.Valores_Read,
    PERMS.Recaudos_Read,
    PERMS.Valores_agregados_Read,
    PERMS.Valores_agregados_Edit,
    PERMS.Contratos_Read,
    PERMS.Contratos_Edit,
    PERMS.ReporteCliente_Download_Word,
    PERMS.RegistrosEliminados_Read,
    PERMS.Whatsapp_Read,
    PERMS.Whatsapp_Write,
    PERMS.Tareas_Read,
  ],

  ejecutivoAdmin: [    
    PERMS.Clientes_Read,
    PERMS.Clientes_Edit,
    PERMS.Deudores_Read,
    PERMS.Deudores_Edit,
    PERMS.Seguimientos_Ejecutivos_Read,
    PERMS.Seguimientos_Ejecutivos_Edit,
    PERMS.Seguimientos_Dependientes_Read,
    PERMS.Seguimientos_Dependientes_Edit,
    PERMS.Seguimientos_Fecha_Edit,
    PERMS.Abonos_Read,
    PERMS.Abonos_Edit,
    PERMS.Valores_Read,
    PERMS.Recaudos_Read,
    PERMS.Valores_agregados_Read,
    PERMS.Valores_agregados_Edit,
    PERMS.Contratos_Read,
    PERMS.Contratos_Edit,
    PERMS.ReporteCliente_Download_Word,
    PERMS.RegistrosEliminados_Read,
    PERMS.Whatsapp_Read,
    PERMS.Whatsapp_Write,
    PERMS.Tareas_Read,
    PERMS.Tareas_Assign,
    PERMS.Tareas_Manage,
  ],

  ejecutivo: [
    PERMS.Clientes_Read,
    PERMS.Clientes_Edit,
    PERMS.Deudores_Read,
    PERMS.Deudores_Edit,
    PERMS.Seguimientos_Ejecutivos_Read,
    PERMS.Seguimientos_Dependientes_Read,
    PERMS.Seguimientos_Ejecutivos_Edit,
    PERMS.Abonos_Read,
    PERMS.Abonos_Edit,
    PERMS.Valores_Read,
    PERMS.Recaudos_Read,
    PERMS.Contratos_Read,
    PERMS.Contratos_Edit,
    PERMS.Valores_agregados_Read,
    PERMS.ReporteCliente_Download_Word,
    PERMS.Whatsapp_Read,
    PERMS.Whatsapp_Write,
    PERMS.Tareas_Read,
    PERMS.Tareas_Estado_Edit,
  ],

  dependiente: [
    PERMS.Clientes_Read,
    PERMS.Clientes_Edit,
    PERMS.Deudores_Read, 
    PERMS.Deudores_Edit,  
    PERMS.Seguimientos_Ejecutivos_Read,
    PERMS.Seguimientos_Dependientes_Read,
    PERMS.Seguimientos_Dependientes_Edit,
    PERMS.Abonos_Read,
    PERMS.Valores_Read,
    PERMS.Recaudos_Read,
    PERMS.Contratos_Read,
    PERMS.ReporteCliente_Download_Word,
    PERMS.Tareas_Read,
    PERMS.Tareas_Assign,
  ],

  cliente: [
    PERMS.Clientes_Read,
    PERMS.Deudores_Read,
    PERMS.Seguimientos_Observaciones_Create,
    PERMS.Seguimientos_Ejecutivos_Read,
    PERMS.Seguimientos_Dependientes_Read,
    PERMS.Abonos_Read,
    PERMS.Valores_Read,  
    PERMS.Valores_agregados_Read,
    PERMS.Valores_agregados_Edit,
    PERMS.Valores_Obs_Create,
    PERMS.Contratos_Read,
    PERMS.ReporteCliente_Download_Pdf,
  ],

  abogado: [
    PERMS.Valores_Read,          
    PERMS.Clientes_Read,
    PERMS.Deudores_Read,
    PERMS.Seguimientos_Ejecutivos_Read,
    PERMS.Seguimientos_Dependientes_Read,
    PERMS.Abonos_Read,
    PERMS.Valores_agregados_Read,
    PERMS.Contratos_Read,
    PERMS.Valores_agregados_Edit,
    PERMS.ReporteCliente_Download_Word,
    PERMS.Tareas_Read,
    PERMS.Tareas_Assign,
  ],

  // Supervisión de franquicia: SOLO lectura + reportes, limitado a franquiciasAsignadas.
  adminFranquicia: [
    PERMS.Clientes_Read,
    PERMS.Deudores_Read,
    PERMS.Seguimientos_Ejecutivos_Read,
    PERMS.Seguimientos_Dependientes_Read,
    PERMS.Abonos_Read,
    PERMS.Recaudos_Read,
    PERMS.Valores_Read,
    PERMS.Valores_agregados_Read,
    PERMS.Contratos_Read,
    PERMS.ReporteCliente_Download_Word,
    PERMS.Tareas_Read,
  ],

  deudor: [
    PERMS.Deudores_Read,
  ],
};

// helper opcional
export type CanFn = (required: Perm | Perm[]) => boolean;
export function crudMode(can: CanFn, p: { view: Perm; edit: Perm }) {
  if (can(p.edit)) return "rw" as const;
  if (can(p.view)) return "ro" as const;
  return "none" as const;
}

export function sanitizeRoles(input: unknown): Rol[] {
  if (!Array.isArray(input)) return [];
  return input.filter((r): r is Rol => ROLES.includes(r as Rol));
}

// === Alcance por franquicia (segundo eje, independiente de los permisos) ===
// "ALL" = sin restricción de franquicia. Un array = solo esas franquicias.
export type AlcanceFranquicias = "ALL" | string[];

// Roles que ven TODAS las franquicias.
const FRANQUICIA_FULL_ACCESS: Rol[] = ["admin", "supervisor", "ejecutivoAdmin"];

/**
 * Devuelve qué franquicias puede ver un usuario.
 * - admin / supervisor / ejecutivoAdmin → "ALL".
 * - adminFranquicia → sus franquiciasAsignadas (solo consulta/reportes).
 * - resto (ejecutivo, dependiente, abogado, cliente, deudor) → "ALL":
 *   NO se filtran por franquicia; su alcance real es por cliente asignado.
 */
export function franquiciasVisibles(params: {
  roles?: Rol[];
  franquiciasAsignadas?: string[];
}): AlcanceFranquicias {
  const roles = params.roles ?? [];
  if (roles.some((r) => FRANQUICIA_FULL_ACCESS.includes(r))) return "ALL";
  if (roles.includes("adminFranquicia")) return params.franquiciasAsignadas ?? [];
  return "ALL";
}
