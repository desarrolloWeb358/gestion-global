import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/shared/ui/sidebar";
import { AppSidebar } from "@/app/layout/app-sidebar";
import { Toaster } from "sonner";

/**
 * Key del <Outlet>: cambiarla remonta la pantalla. Se hace a propósito en cada
 * cambio de ruta para evitar crashes con el DOM alterado por extensiones.
 *
 * Excepción: la bandeja de WhatsApp es maestro-detalle. La conversación abierta
 * viaja en la URL, pero el usuario sigue en la misma pantalla; remontar ahí le
 * borra el filtro por ejecutivo/conjunto, el alcance y la posición del scroll
 * en cada clic. Todas las rutas de un mismo número comparten key.
 */
function outletKey(pathname: string): string {
  const m = pathname.match(/^\/whatsapp\/([^/]+)/);
  if (m && !/\/templates\/?$/.test(pathname)) return `whatsapp:${m[1]}`;
  return pathname;
}

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
          <Outlet key={outletKey(location.pathname)} />
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
