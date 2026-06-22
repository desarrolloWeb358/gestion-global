import { auth, db } from "@/firebase";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";

export async function cambiarCorreoLogin(
  nuevoEmail: string,
  passwordActual: string
) {
  const user = auth.currentUser;
  if (!user) throw new Error("No hay usuario autenticado.");

  const providers = user.providerData.map(p => p.providerId);
  if (!providers.includes("password")) {
    throw new Error("Las cuentas de Google no pueden cambiar el correo de inicio de sesión.");
  }

  if (!user.email) throw new Error("Correo actual no disponible.");

  // 🔐 Re-autenticación obligatoria
  const cred = EmailAuthProvider.credential(user.email, passwordActual);
  await reauthenticateWithCredential(user, cred);

  // 🔁 Cambiar email en Auth
  await updateEmail(user, nuevoEmail);

  // 🔄 Sincronizar en Firestore (usuarios)
  await updateDoc(doc(db, "usuarios", user.uid), {
    email: nuevoEmail,
  });

  return true;
}
