import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/shared/ui/sidebar";
import { AppSidebar } from "@/app/layout/app-sidebar";
import { Toaster } from "sonner";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const location = useLocation();

  return (
    <div translate="no" className="notranslate">
      {/* Sidebar fijo */}
      <AppSidebar />

      {/* Contenido principal */}
      <main
        className={`flex-1 transition-all duration-300 ease-in-out relative ${
          isMobileOpen
            ? "ml-0"
            : isExpanded || isHovered
            ? "lg:ml-[var(--sidebar-width)]"
            : "lg:ml-[var(--sidebar-width-icon)]"
        }`}
      >
        <header className="flex items-center justify-between p-4 border-b">
          <SidebarTrigger />
        </header>

        <div className="p-4 mx-auto w-full max-w-screen-2xl md:p-6">
          {/* remount por ruta para evitar crashes raros con DOM alterado */}
          <Outlet key={location.pathname} />
        </div>
      </main>
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <LayoutContent />
      <Toaster richColors position="top-center" />
    </SidebarProvider>
  );
};

export default AppLayout;
