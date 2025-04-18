import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../firebase";
import { UsuarioSistema } from "../../usuarios/models/usuarioSistema.model";

export const useUsuarioActual = () => {
  const [usuario, setUsuario] = useState<UsuarioSistema | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarUsuario = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        const ref = doc(db, "usuarios", user.uid);
        const snapshot = await getDoc(ref);
        if (snapshot.exists()) {
          setUsuario({ uid: snapshot.id, ...snapshot.data() } as UsuarioSistema);
        }
      }
      setLoading(false);
    };

    cargarUsuario();
  }, []);

  return { usuario, loading };
};
