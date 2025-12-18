// src/app/layout/app-sidebar.tsx
"use client";

import * as React from "react";
import {
  IconLogout,
  IconLoader2,
  IconSettings,
} from "@tabler/icons-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { NAV_ITEMS, type NavItem } from "@/app/layout/nav.config";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { cerrarSesion } from "@/modules/auth/services/authService";

import { NavMain } from "@/app/layout/sidebar/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/shared/ui/sidebar";
import { Separator } from "@/shared/ui/separator";
import { cn } from "@/shared/lib/cn";
import { Earth } from "lucide-react";

function useFilteredNav(items: NavItem[]) {
  const { roles, can, loading } = useAcl();

  const filtered = useMemo(() => {
    const allow = (it: NavItem) => {
      const okRole = !it.roles || it.roles.some(r => roles.includes(r));
      const okPerm = !it.perm || can(it.perm);
      return okRole && okPerm;
    };
    return items.filter(allow);
  }, [items, roles, can]);

  return { items: filtered, loading };
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const navigate = useNavigate();
  const { items, loading } = useFilteredNav(NAV_ITEMS);
  const { usuario, roles } = useAcl();
  const { state } = useSidebar();
  
  const isCollapsed = state === "collapsed";

  // Estado de carga
  if (loading) {
    return (
      <Sidebar
        collapsible="offcanvas"
        className="!bg-[#004B87] border-r !border-white/10"
        {...props}
      >
        <SidebarHeader className="!bg-[#004B87] border-b !border-white/10 p-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 !bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Earth className="w-7 h-7 !text-[#004B87]" strokeWidth={2} />
                </div>
                <span className="text-base font-bold !text-white">
                  Gestión Global
                </span>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className="!bg-[#004B87] flex items-center justify-center py-8">
          <div className="text-center space-y-3">
            <IconLoader2 className="h-8 w-8 animate-spin !text-white mx-auto" />
            <p className="text-sm !text-white/60">Cargando menú...</p>
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  const navMain = items.map(it => ({
    title: it.label,
    path: it.to,
    icon: it.icon,
  }));

  const onLogout = async () => {
    await cerrarSesion();
    navigate("/signin", { replace: true });
  };

  // Obtener información del usuario
  const userName = usuario?.email?.split('@')[0] || "Usuario";
  const userEmail = usuario?.email || "";
  const userRole = roles.length > 0 ? roles[0] : "usuario";

  // Obtener las iniciales del usuario
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sidebar
      collapsible="offcanvas"
      className="!bg-[#004B87] !text-white border-r !border-white/10"
      {...props}
    >
      {/* HEADER con Logo */}
      <SidebarHeader className="!bg-[#004B87] border-b !border-white/10 p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 !bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                <Earth className="w-7 h-7 !text-[#004B87]" strokeWidth={2} />
              </div>
              {!isCollapsed && (
                <div className="flex flex-col">
                  <span className="text-base font-bold !text-white leading-tight">
                    Gestión Global
                  </span>
                  <span className="text-xs !text-white/70">
                    ACG SAS
                  </span>
                </div>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* CONTENIDO - Navegación */}
      <SidebarContent className="!bg-[#004B87] px-2 py-4">
        <NavMain items={navMain} />
      </SidebarContent>

      {/* FOOTER con Usuario y Logout */}
      <SidebarFooter className="!bg-[#004B87] border-t !border-white/10 p-3 space-y-2">
        {!isCollapsed ? (
          <>
            {/* Información del usuario - Expandido */}
            <div className="rounded-lg !bg-white/10 p-3 transition-all duration-200 hover:!bg-white/15 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full !bg-white !text-[#004B87] font-bold text-sm shadow-md flex-shrink-0">
                  {getInitials(userName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold !text-white truncate">
                    {userName}
                  </p>
                  <p className="text-xs !text-white/70 truncate">
                    {userEmail}
                  </p>
                  <span className="inline-flex items-center rounded-full !bg-white/20 px-2 py-0.5 text-xs font-medium !text-white capitalize mt-1">
                    {userRole}
                  </span>
                </div>
              </div>
            </div>

            <Separator className="my-2 !bg-white/20" />

            {/* Botones de acción - Expandido */}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {/* Acción de configuración */}}
                  className={cn(
                    "w-full !text-white/80 hover:!bg-white/10 hover:!text-white transition-all duration-200",
                    "data-[slot=sidebar-menu-button]:justify-start data-[slot=sidebar-menu-button]:gap-3",
                    "group"
                  )}
                >
                  <IconSettings className="!size-5 !text-white/80 group-hover:!text-white" />
                  <span className="font-medium">Configuración</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onLogout}
                  className={cn(
                    "w-full !text-white/80 hover:!bg-red-500/20 hover:!text-white transition-all duration-200",
                    "data-[slot=sidebar-menu-button]:justify-start data-[slot=sidebar-menu-button]:gap-3",
                    "group"
                  )}
                >
                  <IconLogout className="!size-5 !text-white/80 group-hover:!text-white transition-transform group-hover:translate-x-1" />
                  <span className="font-medium">Cerrar Sesión</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </>
        ) : (
          <>
            {/* Información del usuario - Colapsado */}
            <div className="flex flex-col items-center gap-2">
              <div 
                className="flex h-10 w-10 items-center justify-center rounded-full !bg-white !text-[#004B87] font-bold text-sm shadow-md cursor-pointer hover:scale-105 transition-transform"
                title={`${userName} - ${userEmail}`}
              >
                {getInitials(userName)}
              </div>
            </div>

            <Separator className="my-2 !bg-white/20" />

            {/* Botones de acción - Colapsado */}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {/* Acción de configuración */}}
                  className={cn(
                    "w-full !text-white/80 hover:!bg-white/10 hover:!text-white transition-all duration-200",
                    "data-[slot=sidebar-menu-button]:justify-center",
                    "group"
                  )}
                  tooltip="Configuración"
                >
                  <IconSettings className="!size-5 !text-white/80 group-hover:!text-white" />
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onLogout}
                  className={cn(
                    "w-full !text-white/80 hover:!bg-red-500/20 hover:!text-white transition-all duration-200",
                    "data-[slot=sidebar-menu-button]:justify-center",
                    "group"
                  )}
                  tooltip="Cerrar Sesión"
                >
                  <IconLogout className="!size-5 !text-white/80 group-hover:!text-white transition-transform group-hover:translate-x-1" />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}