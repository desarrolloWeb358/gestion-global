import React from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/shared/ui/sidebar";
import { AppSidebar } from "@/app/layout/app-sidebar"; // Tu componente lateral
import { Toaster } from "sonner";


const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  return (
    <div >
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
        {/* Header con botón para colapsar/expandir sidebar */}
        <header className="flex items-center justify-between p-4 border-b">
          <SidebarTrigger />
        </header>

        {/* Contenido interior */}
        <div className="p-4 mx-auto w-full max-w-screen-2xl md:p-6">
          <Outlet />
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
