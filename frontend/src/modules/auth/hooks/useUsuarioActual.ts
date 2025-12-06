// src/modules/auth/hooks/useUsuarioActual.ts
import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import type { Rol } from "@/shared/constants/acl";

export function useUsuarioActual() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [usuarioSistema, setUsuarioSistema] = useState<UsuarioSistema | null>(null);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setUsuario(user);
      if (!user) {
        setUsuarioSistema(null);
        setRoles([]);
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "usuarios", user.uid));
        if (snap.exists()) {
          const data = snap.data() as UsuarioSistema;
          setUsuarioSistema(data);
          setRoles(data.roles ?? []);
        } else {
          setUsuarioSistema(null);
          setRoles([]);
        }
      } catch (e) {
        console.error("[useUsuarioActual] Error leyendo usuario:", e);
        setUsuarioSistema(null);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  return { usuario, usuarioSistema, roles, loading };
}
