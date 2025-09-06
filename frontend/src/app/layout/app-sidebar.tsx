// src/app/layout/app-sidebar.tsx
"use client";

import * as React from "react";
import {
  IconInnerShadowTop,
  IconLogout,
} from "@tabler/icons-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { NAV_ITEMS, type NavItem } from "@/app/layout/nav.config";
import { useAcl } from "@/modules/auth/hooks/useAcl";     // ← usa roles/permisos del usuario
import { cerrarSesion } from "@/modules/auth/services/authService";

import { NavMain } from "@/app/layout/sidebar/nav-main";
import { NavUser } from "@/app/layout/sidebar/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/shared/ui/sidebar";

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

  // mientras carga el usuario, evita parpadeo
  if (loading) {
    return (
      <Sidebar collapsible="offcanvas" {...props}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="data-[slot=sidebar-menu-button]:!p-1.5">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold whitespace-nowrap">
                  Gestión Global ACG SAS
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent />
      </Sidebar>
    );
  }

  // adapta a la forma que espera tu <NavMain />
  const navMain = items.map(it => ({
    title: it.label,
    path: it.to,
    icon: it.icon,
  }));

  const onLogout = async () => {
    await cerrarSesion();
    navigate("/signin", { replace: true });
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <a href="#">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold whitespace-nowrap">
                  Gestión Global ACG SAS
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>

      <SidebarFooter>
        {/* puedes pasarle los datos del usuario real si tu NavUser los usa */}
        <NavUser user={{ name: "Usuario", email: "", avatar: "" }} />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onLogout}>
              <IconLogout className="!size-5" />
              <span>Salir</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
