import { useEffect } from "react";

/**
 * Conjunto de guards activos. Cada guard es una función que retorna
 * true si el usuario confirma salir, false si decide quedarse.
 */
const navigationGuards = new Set<() => boolean>();

/**
 * Verifica todos los guards activos. Llámalo antes de navegar.
 * Retorna true si se puede navegar, false si el usuario canceló.
 */
export function checkNavigationGuards(): boolean {
  for (const guard of navigationGuards) {
    if (!guard()) return false;
  }
  return true;
}

/**
 * Bloquea la navegación y el cierre de pestaña cuando hay cambios sin guardar.
 * Compatible con BrowserRouter (no requiere data router).
 *
 * @param isDirty  true cuando el usuario ha escrito algo que no se ha guardado
 */
export function useUnsavedChanges(isDirty: boolean) {
  // Avisa al cerrar/refrescar la pestaña del navegador
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Registra un guard para navegación interna (breadcrumbs, etc.)
  useEffect(() => {
    if (!isDirty) return;
    const guard = () =>
      window.confirm(
        "Tienes cambios sin guardar.\n¿Salir sin guardar? Lo que escribiste se perderá."
      );
    navigationGuards.add(guard);
    return () => {
      navigationGuards.delete(guard);
    };
  }, [isDirty]);
}
