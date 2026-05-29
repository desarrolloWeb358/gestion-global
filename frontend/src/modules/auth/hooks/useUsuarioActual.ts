import { useUsuarioActualContext } from "@/app/providers/UsuarioActualContext";

export function useUsuarioActual() {
  return useUsuarioActualContext();
}
