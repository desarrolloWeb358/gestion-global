import { functions } from "@/firebase";
import { httpsCallable } from "firebase/functions";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";

export async function actualizarUsuarioDesdeAdmin(payload: UsuarioSistema) {
  const fn = httpsCallable(functions, "actualizarUsuarioDesdeAdmin");
  const res = await fn(payload);
  return res.data as { ok: boolean; emailAnterior?: string; emailNuevo?: string };
}
