import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/firebase";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { sanitizeRoles, type Rol } from "@/shared/constants/acl";

interface UsuarioActualState {
  usuario: User | null;
  usuarioSistema: UsuarioSistema | null;
  roles: Rol[];
  loading: boolean;
}

const UsuarioActualContext = createContext<UsuarioActualState>({
  usuario: null,
  usuarioSistema: null,
  roles: [],
  loading: true,
});

// Cache en módulo para no perder datos entre re-renders en StrictMode
let cachedState: UsuarioActualState | null = null;

export function UsuarioActualProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UsuarioActualState>(
    () => cachedState ?? { usuario: null, usuarioSistema: null, roles: [], loading: true }
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        const next = { usuario: null, usuarioSistema: null, roles: [], loading: false };
        cachedState = next;
        setState(next);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        const next: UsuarioActualState = snap.exists()
          ? { usuario: user, usuarioSistema: snap.data() as UsuarioSistema, roles: sanitizeRoles((snap.data() as UsuarioSistema).roles), loading: false }
          : { usuario: user, usuarioSistema: null, roles: [], loading: false };
        cachedState = next;
        setState(next);
      } catch {
        const next = { usuario: user, usuarioSistema: null, roles: [], loading: false };
        cachedState = next;
        setState(next);
      }
    });
    return unsub;
  }, []);

  return (
    <UsuarioActualContext.Provider value={state}>
      {children}
    </UsuarioActualContext.Provider>
  );
}

export const useUsuarioActualContext = () => useContext(UsuarioActualContext);
