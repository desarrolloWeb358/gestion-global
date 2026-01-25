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
    icon?: SidebarIcon;
    badge?: number | string;
  }[];
}) {
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu />
        <SidebarMenu>
          {items.map((item) => {
            const shouldShowBadge =
              item.badge != null &&
              (typeof item.badge === "number"
                ? item.badge > 0
                : String(item.badge).trim() !== "");

            return (
              <SidebarMenuItem key={item.title}>
                <Link to={item.path} className="w-full">
                  <SidebarMenuButton tooltip={item.title}>
                    {item.icon && <item.icon className="!size-5" />}

                    <span className="flex-1">{item.title}</span>

                    {shouldShowBadge && (
                      <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
