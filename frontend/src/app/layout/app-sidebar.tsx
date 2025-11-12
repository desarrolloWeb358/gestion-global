// src/app/layout/app-sidebar.tsx
"use client";

import * as React from "react";
import {
  IconInnerShadowTop,
  IconLogout,
  IconLoader2,
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
} from "@/shared/ui/sidebar";
import { Separator } from "@/shared/ui/separator";
import { cn } from "@/shared/lib/cn";
import logo from "@/assets/brand/logo.png";

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
  const { usuario, roles } = useAcl(); // 👈 Ya tienes usuario y roles aquí

  // Estado de carga
  if (loading) {
    return (
      <Sidebar 
        collapsible="offcanvas" 
        className="border-r border-brand-secondary/20 bg-gradient-to-b from-white to-brand-primary/5"
        {...props}
      >
        <SidebarHeader className="border-b border-brand-secondary/10 bg-white/80 backdrop-blur-sm">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="data-[slot=sidebar-menu-button]:!p-3 hover:bg-brand-primary/5">
                <IconInnerShadowTop className="!size-5 text-brand-primary" />
                <span className="text-base font-semibold text-brand-secondary">
                  Gestión Global ACG SAS
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-3">
            <IconLoader2 className="h-8 w-8 animate-spin text-brand-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Cargando menú...</p>
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
  const userName = usuario?.nombre || usuario?.email?.split('@')[0] || "Usuario";
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
      className="border-r border-brand-secondary/20 bg-gradient-to-b from-white to-brand-primary/5"
      {...props}
    >
      {/* HEADER con Logo */}
      <SidebarHeader className="border-b border-brand-secondary/10 bg-white/80 backdrop-blur-sm p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-center py-2">
              <img
                src={logo}
                alt="Gestión Global ACG SAS"
                className="h-16 w-auto object-contain transition-all duration-300 group-data-[state=collapsed]:h-10"
              />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* CONTENIDO - Navegación */}
      <SidebarContent className="px-2 py-4">
        <NavMain items={navMain} />
      </SidebarContent>

      {/* FOOTER con Usuario y Logout */}
      <SidebarFooter className="border-t border-brand-secondary/10 bg-white/80 backdrop-blur-sm p-3">
        {/* Información del usuario */}
        <div className="mb-2 rounded-lg bg-brand-primary/5 p-3 transition-colors hover:bg-brand-primary/10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-white font-semibold text-sm shadow-sm">
              {getInitials(userName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-brand-secondary truncate">
                {userName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {userEmail}
              </p>
              <span className="inline-flex items-center rounded-full bg-brand-secondary/10 px-2 py-0.5 text-xs font-medium text-brand-secondary capitalize mt-1">
                {userRole}
              </span>
            </div>
          </div>
        </div>

        <Separator className="my-2 bg-brand-secondary/10" />

        {/* Botón de logout */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={onLogout}
              className={cn(
                "w-full hover:bg-red-50 hover:text-red-600 transition-all duration-200",
                "data-[slot=sidebar-menu-button]:justify-start data-[slot=sidebar-menu-button]:gap-3",
                "group"
              )}
            >
              <IconLogout className="!size-5 transition-transform group-hover:translate-x-1" />
              <span className="font-medium">Cerrar Sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}