import { useEffect, useSyncExternalStore } from "react";

/**
 * Guarda global de "cambios sin guardar".
 *
 * Una pantalla se declara sucia con useUnsavedChanges(true). A partir de ahí,
 * cualquier intento de salir pasa por pedirLeave(), que abre el diálogo de
 * confirmación montado en AppLayout (<UnsavedChangesGuard />).
 *
 * Compatible con BrowserRouter: no requiere data router ni useBlocker.
 */

type EstadoGuard = {
  /** Hay al menos una pantalla con cambios sin guardar. */
  bloqueado: boolean;
  /** El diálogo de confirmación está abierto esperando respuesta. */
  preguntando: boolean;
};

let pantallasSucias = 0;
let resolverPendiente: ((salir: boolean) => void) | null = null;
let snapshot: EstadoGuard = { bloqueado: false, preguntando: false };
const listeners = new Set<() => void>();

function emitir() {
  snapshot = {
    bloqueado: pantallasSucias > 0,
    preguntando: resolverPendiente !== null,
  };
  listeners.forEach((l) => l());
}

function suscribir(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** true si alguna pantalla tiene cambios sin guardar. */
export function hayCambiosSinGuardar() {
  return pantallasSucias > 0;
}

/**
 * Pide permiso para abandonar la pantalla.
 * - Sin cambios pendientes: resuelve true de inmediato.
 * - Con cambios: abre el diálogo y resuelve según lo que elija el usuario.
 * - Si ya hay un diálogo abierto: resuelve false (no se apilan preguntas).
 */
export function pedirSalida(): Promise<boolean> {
  if (pantallasSucias === 0) return Promise.resolve(true);
  if (resolverPendiente) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    resolverPendiente = resolve;
    emitir();
  });
}

/** Respuesta del diálogo. La llama <UnsavedChangesGuard />. */
export function responderSalida(salir: boolean) {
  const resolver = resolverPendiente;
  resolverPendiente = null;
  emitir();
  resolver?.(salir);
}

/** Estado reactivo del guard, para el componente del diálogo. */
export function useUnsavedChangesState(): EstadoGuard {
  return useSyncExternalStore(suscribir, () => snapshot, () => snapshot);
}

/**
 * Marca la pantalla como "con cambios sin guardar".
 *
 * @param isDirty true cuando el usuario escribió algo que aún no se guarda
 */
export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;

    pantallasSucias += 1;
    emitir();

    // Cerrar/refrescar la pestaña: aviso nativo del navegador (no se puede
    // personalizar, es el único que el navegador permite en ese momento).
    const avisarDescarga = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avisarDescarga);

    return () => {
      pantallasSucias -= 1;
      emitir();
      window.removeEventListener("beforeunload", avisarDescarga);
      // Si la pantalla se desmonta con un diálogo abierto, lo soltamos.
      if (pantallasSucias === 0 && resolverPendiente) responderSalida(true);
    };
  }, [isDirty]);
}
