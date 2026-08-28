import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Pencil, LogOut } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Typography } from "@/shared/design-system/components/Typography";
import {
  pedirSalida,
  responderSalida,
  useUnsavedChangesState,
} from "@/shared/hooks/useUnsavedChanges";

/**
 * Se monta una sola vez en AppLayout. Hace dos cosas mientras haya una pantalla
 * con cambios sin guardar (ver useUnsavedChanges):
 *
 *  1. Intercepta los clics en enlaces (sidebar, breadcrumbs, cualquier <a>)
 *     antes de que React Router los procese, y pregunta antes de navegar.
 *  2. Atrapa el botón "atrás" del navegador con una entrada centinela.
 *
 * Los botones que navegan por código (BackButton, AppBreadcrumb) llaman a
 * pedirSalida() directamente, porque no son enlaces y no hay clic que atrapar.
 */
export function UnsavedChangesGuard() {
  const { bloqueado, preguntando } = useUnsavedChangesState();
  const navigate = useNavigate();

  /* ─── 1. Clics en enlaces ─── */
  useEffect(() => {
    if (!bloqueado) return;

    const alHacerClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const enlace = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!enlace) return;
      if (enlace.target && enlace.target !== "_self") return;
      if (enlace.hasAttribute("download")) return;

      const href = enlace.getAttribute("href") ?? "";
      if (!href || href.startsWith("#")) return;
      if (/^(mailto|tel|javascript):/i.test(href)) return;

      const destino = new URL(enlace.href, window.location.href);
      if (destino.href === window.location.href) return;

      // Capture + stopPropagation: el onClick de <Link> nunca llega a correr.
      e.preventDefault();
      e.stopPropagation();

      pedirSalida().then((salir) => {
        if (!salir) return;
        if (destino.origin === window.location.origin) {
          navigate(destino.pathname + destino.search + destino.hash);
        } else {
          window.location.href = destino.href;
        }
      });
    };

    document.addEventListener("click", alHacerClic, true);
    return () => document.removeEventListener("click", alHacerClic, true);
  }, [bloqueado, navigate]);

  /* ─── 2. Botón "atrás" del navegador ─── */
  useEffect(() => {
    if (!bloqueado) return;

    // Entrada centinela: el primer "atrás" la consume sin cambiar de pantalla.
    window.history.pushState({ ggGuard: true }, "");
    let activo = true;

    const alVolver = () => {
      if (!activo) return;
      // Reponemos el centinela para no movernos mientras preguntamos.
      window.history.pushState({ ggGuard: true }, "");
      pedirSalida().then((salir) => {
        if (!salir) return;
        activo = false;
        // Descarta el centinela y la entrada real de esta pantalla.
        window.history.go(-2);
      });
    };

    window.addEventListener("popstate", alVolver);
    return () => {
      activo = false;
      window.removeEventListener("popstate", alVolver);
      // No deshacemos el centinela: llamar a history.back() aquí podría sacar
      // al usuario de la pantalla a la que acaba de llegar. Queda una entrada
      // de más en el historial, que es inofensiva.
    };
  }, [bloqueado]);

  /* ─── 3. Escape = seguir editando ─── */
  useEffect(() => {
    if (!preguntando) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        responderSalida(false);
      }
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [preguntando]);

  if (!preguntando) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="unsaved-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 shadow shrink-0">
            <AlertTriangle className="h-6 w-6 text-white" />
          </div>
          <div className="space-y-1">
            <Typography
              id="unsaved-title"
              variant="h3"
              className="!text-brand-secondary font-bold"
            >
              ¿Salir sin guardar?
            </Typography>
            <Typography variant="small" className="text-muted-foreground">
              Tienes información escrita que todavía no se ha guardado. Si sales
              ahora vas a perder todo el trabajo realizado en esta pantalla.
            </Typography>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            onClick={() => responderSalida(true)}
          >
            <LogOut className="h-4 w-4" />
            Sí, salir
          </Button>
          <Button
            type="button"
            variant="brand"
            className="gap-2"
            autoFocus
            onClick={() => responderSalida(false)}
          >
            <Pencil className="h-4 w-4" />
            Continuar editando
          </Button>
        </div>
      </div>
    </div>
  );
}
