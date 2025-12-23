// src/modules/notificaciones/components/NotificacionesPage.tsx
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { 
  Bell, 
  BellOff, 
  Check, 
  ChevronRight,
  Calendar,
  Package,
  ArrowLeft
} from "lucide-react";

import { auth } from "@/firebase";
import { Typography } from "@/shared/design-system/components/Typography";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";
import { useNotificacionesUsuario } from "@/modules/notificaciones/hooks/useNotificacionesUsuario";
import { NotificacionAlerta } from "../models/notificacion.model";
import { marcarNotificacionComoVista } from "../services/notificacionService";

const fmt = new Intl.DateTimeFormat("es-CO", { 
  year: "numeric", 
  month: "short", 
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true
});

export default function NotificacionesPage() {
  const [user, setUser] = React.useState<User | null>(null);
  const [authLoading, setAuthLoading] = React.useState(true);
  const navigate = useNavigate();

  // Escuchar cambios de autenticación
  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        navigate("/signin");
      } else {
        setUser(firebaseUser);
      }
      setAuthLoading(false);
    });

    return () => unsub();
  }, [navigate]);

  const { todas, totalNoVistas, loading } = useNotificacionesUsuario(user?.uid);

  const handleClickNotif = async (notif: NotificacionAlerta) => {
    if (!notif.id) return;

    if (!notif.visto) {
      await marcarNotificacionComoVista(user!.uid, notif.id);
    }

    if (notif.ruta) {
      navigate(notif.ruta);
    }
  };

  const formatFecha = (fecha: any): string => {
    try {
      if (!fecha) return "";
      const d = typeof fecha?.toDate === "function" ? fecha.toDate() : new Date(fecha);
      return fmt.format(d);
    } catch {
      return "";
    }
  };

  const getModuloIcon = (modulo: string) => {
    switch (modulo.toLowerCase()) {
      case "cobranza":
      case "deudor":
        return Package;
      default:
        return Bell;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
          <Typography variant="body" >
            Cargando notificaciones...
          </Typography>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm max-w-md">
          <div className="p-4 rounded-full bg-brand-primary/10 w-fit mx-auto mb-4">
            <BellOff className="h-8 w-8 text-brand-primary/60" />
          </div>
          <Typography variant="h3" className="text-brand-secondary mb-2">
            Acceso restringido
          </Typography>
          <Typography variant="small" >
            Debes iniciar sesión para ver tus notificaciones.
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* Botón volver */}
      <div className="mb-4">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="gap-2 text-brand-secondary hover:text-brand-primary hover:bg-brand-primary/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
      </div>

      {/* Header */}
      <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-5 md:p-6 border-b border-brand-secondary/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-brand-primary/10">
                <Bell className="h-6 w-6 text-brand-primary" />
              </div>
              <div>
                <Typography variant="h2" className="!text-brand-secondary">
                  Notificaciones
                </Typography>
                <Typography variant="small" className=" mt-0.5">
                  Centro de alertas y actualizaciones
                </Typography>
              </div>
            </div>
            
            {totalNoVistas > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200">
                <div className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
                <Typography variant="small" className="font-semibold text-blue-700">
                  {totalNoVistas} {totalNoVistas === 1 ? "nueva" : "nuevas"}
                </Typography>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Lista de notificaciones */}
      {todas.length === 0 ? (
        <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 rounded-full bg-brand-primary/10">
              <Check className="h-8 w-8 text-brand-primary/60" />
            </div>
            <Typography variant="h3" className="text-brand-secondary">
              Todo al día
            </Typography>
            <Typography variant="small" className="max-w-sm">
              No tienes notificaciones pendientes. Te avisaremos cuando haya novedades.
            </Typography>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {todas.map((notif, index) => {
            const ModuloIcon = getModuloIcon(notif.modulo);
            const fechaStr = formatFecha((notif as any).fechaCreacion ?? (notif as any).createdAt ?? (notif as any).fecha);
            
            return (
              <div
                key={notif.id}
                onClick={() => handleClickNotif(notif)}
                className={cn(
                  "group rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden",
                  "hover:shadow-md hover:border-brand-primary/30",
                  notif.visto
                    ? "bg-white border-brand-secondary/10"
                    : "bg-gradient-to-r from-blue-50/80 to-white border-blue-200 shadow-sm"
                )}
              >
                <div className="flex items-start gap-4 p-4 md:p-5">
                  {/* Icono del módulo */}
                  <div 
                    className={cn(
                      "flex-shrink-0 p-2.5 rounded-lg transition-colors",
                      notif.visto 
                        ? "bg-brand-primary/10 text-brand-primary"
                        : "bg-blue-100 text-blue-600"
                    )}
                  >
                    <ModuloIcon className="h-5 w-5" />
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <Typography 
                        variant="body" 
                        className={cn(
                          "font-medium leading-snug",
                          notif.visto ? "text-gray-700" : "text-gray-900"
                        )}
                      >
                        {notif.descripcion}
                      </Typography>
                      
                      {!notif.visto && (
                        <span className="flex-shrink-0 h-2.5 w-2.5 rounded-full bg-blue-500 mt-1.5" />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5" />
                        {notif.modulo}
                      </span>
                      {fechaStr && (
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {fechaStr}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Indicador de navegación */}
                  {notif.ruta && (
                    <div className="flex-shrink-0">
                      <ChevronRight 
                        className={cn(
                          "h-5 w-5 transition-all",
                          " group-hover:text-brand-primary",
                          "group-hover:translate-x-0.5"
                        )}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}