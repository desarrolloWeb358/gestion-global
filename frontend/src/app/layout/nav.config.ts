// src/app/layout/nav.config.ts

import type { Rol, Perm } from "@/shared/constants/acl";
import type { ComponentType } from "react";

// Tipo común para iconos del sidebar (Tabler u otros)
export type SidebarIcon = ComponentType<{ className?: string }>;

import {
  IconUsers,
  IconSearch,
  IconBell,
  IconLayoutDashboard,
  IconBriefcase,
  IconGavel,
  IconFileText,
  IconCreditCard,
  IconUserCircle,
  IconChartBar,
  IconClipboardList,
} from "@tabler/icons-react";

export type NavItem = {
  to: string;
  label: string;
  icon?: SidebarIcon;
  roles?: Rol[];
  perm?: Perm | Perm[];
};

export const NAV_ITEMS: NavItem[] = [
  // ========================================
  // DASHBOARDS POR ROL
  // ========================================
  { 
    to: "/dashboard/admin", 
    label: "Administrador", 
    icon: IconLayoutDashboard,
    roles: ["admin"] 
  },
  { 
    to: "/dashboard/ejecutivo", 
    label: "Ejecutivo", 
    icon: IconLayoutDashboard,
    roles: ["ejecutivo"] 
  },
  { 
    to: "/dashboard/abogado", 
    label: "Abogado", 
    icon: IconLayoutDashboard,
    roles: ["abogado"] 
  },
  { 
    to: "/dashboard/cliente", 
    label: "Dashboard Cliente", 
    icon: IconLayoutDashboard,
    roles: ["cliente"] 
  },
  { 
    to: "/dashboard/deudor", 
    label: "Dashboard Deudor", 
    icon: IconLayoutDashboard,
    roles: ["deudor"] 
  },

  // ========================================
  // ADMINISTRACIÓN
  // ========================================
  { 
    to: "/usuarios-tables", 
    label: "Usuarios", 
    icon: IconUsers, 
    roles: ["admin"] 
  },

  // ========================================
  // GESTIÓN DE COBRANZA
  // ========================================
  { 
    to: "/clientes-tables", 
    label: "Clientes", 
    icon: IconBriefcase, 
    roles: ["admin", "ejecutivo", "abogado"] 
  },

  // ========================================
  // MÓDULOS ADICIONALES (Descomentados)
  // ========================================
  /*{ 
    to: "/consulta-personas", 
    label: "Consulta Personas", 
    icon: IconSearch, 
    roles: ["admin", "cliente"] 
  },*/

  // ========================================
  // REPORTES Y ANÁLISIS
  // ========================================
  // { 
  //   to: "/reportes", 
  //   label: "Reportes", 
  //   icon: IconChartBar, 
  //   roles: ["admin", "ejecutivo"] 
  // },

  // ========================================
  // HERRAMIENTAS Y PRUEBAS
  // ========================================
  /*{ 
    to: "/probar-notificaciones", 
    label: "Notificaciones", 
    icon: IconBell, 
    roles: ["admin"] 
  },*/
];