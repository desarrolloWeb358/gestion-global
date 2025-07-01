"use client"

import * as React from "react"
import {
  IconInnerShadowTop,
  IconSearch,
  IconUsers,
  IconUser,
  IconLogout,
} from "@tabler/icons-react"

import { NavMain } from "../components/sidebar/nav-main"
import { NavUser } from "../components/sidebar/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../components/ui/sidebar"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    { title: "Perfil del usuario", path: "/profile", icon: IconUser },
    {
      title: "Clientes",
      path: "/clientes-tables",
      icon: IconUsers
    },
    {
      title: "Usuarios",
      path: "/Usuarios-tables",
      icon: IconUsers,
    },
    {
      title: "Consultar personas",
      path: "/consulta-rut",
      icon: IconSearch,
    },
    {
      title: "Salir",
      path: "/signin",
      icon: IconLogout,
    },
  ],
}


export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold whitespace-nowrap">Gestión Global ACG SAS</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
