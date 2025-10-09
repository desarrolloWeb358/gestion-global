// src/app/layout/nav.config.ts

import type { Rol, Perm } from "@/shared/constants/acl";
import type { ComponentType } from "react";

// Tipo común para iconos del sidebar (Tabler u otros)
export type SidebarIcon = ComponentType<{ className?: string }>;

import {
  IconUsers,
  IconSearch,
  IconBell,
} from "@tabler/icons-react";

export type NavItem = {
  to: string;
  label: string;
  icon?: SidebarIcon;
  roles?: Rol[];
  perm?: Perm | Perm[];
};

export const NAV_ITEMS: NavItem[] = [
  // Dashboards por rol (opcional, si quieres link directo en menú)
  { to: "/dashboard/admin",     label: "Dashboard", roles: ["admin"] },
  { to: "/dashboard/ejecutivo", label: "Dashboard", roles: ["ejecutivo"] },
  { to: "/dashboard/abogado",   label: "Dashboard", roles: ["abogado"] },
  { to: "/dashboard/cliente",   label: "Dashboard", roles: ["cliente"] },
  { to: "/dashboard/deudor",    label: "Dashboard", roles: ["deudor"] },

  // Administración
  { to: "/usuarios-tables", label: "Usuarios", icon: IconUsers, roles: ["admin"] },

  // Cobranza
  { to: "/clientes-tables",   label: "Clientes", icon: IconUsers, roles: ["admin", "ejecutivo", "abogado"] },
  
  /*
  { to: "/consulta-personas", label: "Consulta personas", icon: IconSearch, roles: ["admin", "cliente"] },

  { to: "/probar-notificaciones", label: "Notificaciones", icon: IconBell, roles: ["admin"] },
   */
];
