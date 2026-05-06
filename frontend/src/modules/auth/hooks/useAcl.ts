// src/modules/auth/hooks/useAcl.ts
import { useMemo, useCallback } from "react";
import { useUsuarioActual } from "./useUsuarioActual";
import { permsFromRoles, can as canFn } from "@/shared/lib/rbac";
import type { Perm } from "@/shared/constants/acl";

export function useAcl() {
  const { usuario, roles, loading, usuarioSistema } = useUsuarioActual();
  const perms = useMemo(() => permsFromRoles(roles), [roles]);
  const can = useCallback((req: Perm | Perm[]) => canFn(perms, req), [perms]);
  const canConsultarPersonas = usuarioSistema?.canConsultarPersonas ?? false;
  return { usuario, roles, perms, can, loading, canConsultarPersonas };
}
