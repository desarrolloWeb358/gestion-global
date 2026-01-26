import { functions } from "@/firebase";
import { httpsCallable } from "firebase/functions";

export type CambiarCorreoUsuarioInput = {
  uid: string;
  emailNuevo: string;
};

export type CambiarCorreoUsuarioResult = {
  ok: boolean;
  emailAnterior?: string;
  emailNuevo?: string;
};

export async function cambiarCorreoUsuarioDesdeAdmin(input: CambiarCorreoUsuarioInput) {
  const fn = httpsCallable<CambiarCorreoUsuarioInput, CambiarCorreoUsuarioResult>(
    functions,
    "cambiarCorreoUsuarioDesdeAdmin"
  );

  const res = await fn({
    uid: input.uid,
    emailNuevo: input.emailNuevo.trim().toLowerCase(),
  });

  return res.data;
}
