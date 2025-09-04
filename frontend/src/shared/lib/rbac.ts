import {
  ROLE_PERMISSIONS,
  ROLE_HOME,
  ROL_PRIORITY,
  DEFAULT_HOME,
  type Rol,
  type Perm,
} from "@/shared/constants/acl";

// Home por rol usando prioridad
export function roleHome(roles?: Rol[]): string {
  if (!roles?.length) return DEFAULT_HOME;
  const winner = ROL_PRIORITY.find((r) => roles.includes(r))!;
  return ROLE_HOME[winner] ?? DEFAULT_HOME;
}

// Conjunto de permisos que surgen de los roles
export function permsFromRoles(roles?: Rol[]): Set<Perm> {
  const set = new Set<Perm>();
  roles?.forEach(r => ROLE_PERMISSIONS[r].forEach(p => set.add(p)));
  return set;
}

// Verifica 1 o varios permisos
export function can(perms: Set<Perm>, required: Perm | Perm[]) {
  return Array.isArray(required) ? required.some(p => perms.has(p)) : perms.has(required);
}
