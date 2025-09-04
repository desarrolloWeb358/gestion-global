// src/modules/auth/hooks/useUsuarioActual.ts
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/firebase";
import { sanitizeRoles, type Rol } from "@/shared/constants/acl";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";

export function useUsuarioActual() {
  const [usuario, setUsuario] = useState<UsuarioSistema | null>(null);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (!fbUser) {
          setUsuario(null);
          setRoles([]);
          setLoading(false);
          return;
        }
        const snap = await getDoc(doc(db, "usuarios", fbUser.uid));
        if (snap.exists()) {
          const data = snap.data() as UsuarioSistema;
          const safeRoles = sanitizeRoles(data.roles);
          setUsuario({ ...data, uid: snap.id, roles: safeRoles });
          setRoles(safeRoles);
        } else {
          console.warn("No existe documento de usuario:", fbUser.uid);
          setUsuario(null);
          setRoles([]);
        }
      } catch (err) {
        console.error("useUsuarioActual error:", err);
        setUsuario(null);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  return { usuario, roles, loading };
}
