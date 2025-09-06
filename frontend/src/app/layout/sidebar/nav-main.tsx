"use client";
import { Link } from "react-router-dom";
import type { SidebarIcon } from "@/app/layout/nav.config";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/shared/ui/sidebar";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    path: string;
    icon?: SidebarIcon; // 👈 ahora coincide con el config
  }[];
}) {
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {/* (opcional) aquí podrías poner una cabecera de grupo */}
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <Link to={item.path} className="w-full">
                <SidebarMenuButton tooltip={item.title}>
                  {item.icon && <item.icon className="!size-5" />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
