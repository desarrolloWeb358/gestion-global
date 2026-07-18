// src/app/layout/nav.config.ts

import type { Rol, Perm } from "@/shared/constants/acl";
import type { ComponentType } from "react";

// Tipo común para iconos del sidebar (Tabler u otros)
export type SidebarIcon = ComponentType<{ className?: string }>;

import {
  IconUsers,
  IconBell,
  IconHome,
  IconBriefcase,
  IconTrash,
  IconBrandWhatsapp,
  IconSettings,
  IconSearch,
  IconEye,
  IconLayoutKanban,
} from "@tabler/icons-react";
import { PERMS } from "@/shared/constants/acl";

export type NavItem = {
  to: string;
  label: string;
  icon?: SidebarIcon;
  roles?: Rol[];
  perm?: Perm | Perm[];
  requireFlag?: "canConsultarPersonas";
};

export const NAV_ITEMS: NavItem[] = [
  // ========================================
  // DASHBOARDS POR ROL
  // ========================================
  {
    to: "/dashboard/admin",
    label: "Administrador",
    icon: IconHome,
    roles: ["admin", "ejecutivoAdmin"]
  },  
  {
    to: "/dashboard/ejecutivo",
    label: "Ejecutivo",
    icon: IconHome,
    roles: ["ejecutivo", "ejecutivoAdmin", "supervisor"]
  },
  {
    to: "/dashboard/dependiente",
    label: "Dependiente",
    icon: IconHome,
    roles: ["dependiente"]
  },
  { 
    to: "/dashboard/cliente", 
    label: "Inicio", 
    icon: IconHome,
    roles: ["cliente"] 
  },
  { 
    to: "/dashboard/deudor", 
    label: "Inicio", 
    icon: IconHome,
    roles: ["deudor"] 
  },

  // ========================================
  // ADMINISTRACIÓN
  // ========================================
  {
    to: "/usuarios-tables",
    label: "Usuarios",
    icon: IconUsers,
    roles: ["admin", "supervisor"]
  },
  {
    to: "/registros-eliminados",
    label: "Registros Eliminados",
    icon: IconTrash,
    roles: ["admin", "supervisor"],
  },

  // ========================================
  // GESTIÓN DE COBRANZA
  // ========================================
  {
    to: "/clientes-tables",
    label: "Clientes",
    icon: IconBriefcase,
    roles: ["admin", "ejecutivo", "ejecutivoAdmin", "supervisor", "dependiente", "abogado", "adminFranquicia"]
  },

  // ========================================
  // PROCESOS JUDICIALES
  // ========================================
  {
    to: "/monitoreo-radicados",
    label: "Monitoreo Radicados",
    icon: IconEye,
    roles: ["admin"],
  },

  // ========================================
  // TAREAS
  // ========================================
  {
    to: "/tareas",
    label: "Tareas",
    icon: IconLayoutKanban,
    roles: ["admin", "ejecutivoAdmin", "ejecutivo"],
    perm: PERMS.Tareas_Read,
  },

  // ========================================
  // WHATSAPP
  // ========================================
  {
    to: "/whatsapp",
    label: "WhatsApp",
    icon: IconBrandWhatsapp,
    roles: ["admin", "ejecutivo", "ejecutivoAdmin", "supervisor"],
  },

  // ========================================
  // NOTIFICACIONES
  // ========================================
  {
    to: "/notificaciones",
    label: "Notificaciones",
    icon: IconBell,
    roles: ["admin", "ejecutivo", "ejecutivoAdmin", "supervisor", "dependiente", "abogado", "cliente", "deudor", "adminFranquicia"]
  },

  // ========================================
  // AJUSTES (solo ejecutivoAdmin)
  // ========================================
  {
    to: "/ajustes",
    label: "Ajustes",
    icon: IconSettings,
    roles: ["supervisor"],
  },

  // ========================================
  // MÓDULOS ADICIONALES (Descomentados)
  // ========================================
  {
    to: "/consulta-personas",
    label: "Consulta Personas",
    icon: IconSearch,
    requireFlag: "canConsultarPersonas",
  },

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