// src/common/auth/services/authService.ts
import { auth } from "@/firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
} from "firebase/auth";

/** Mapea códigos de Firebase Auth a mensajes cortos en español */
function normalizeAuthError(code?: string): string {
  const map: Record<string, string> = {
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/wrong-password": "Contraseña incorrecta.",            // (SDKs antiguos)
    "auth/user-not-found": "Usuario no encontrado.",            // (SDKs antiguos)
    "auth/invalid-email": "Correo inválido.",
    "auth/user-disabled": "Usuario deshabilitado.",
    "auth/too-many-requests": "Demasiados intentos. Inténtalo más tarde.",
    "auth/popup-closed-by-user": "Se cerró la ventana antes de terminar.",
    "auth/cancelled-popup-request": "Se canceló la ventana emergente.",
    "auth/popup-blocked": "El navegador bloqueó la ventana emergente.",
    default: "No se pudo completar la operación.",
  };
  if (!code) return map.default;
  return map[code] ?? map.default;
}

/** Opcional: forzar persistencia en localStorage para mantener sesión tras recargar */
async function ensurePersistence() {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    // Ignorar: si falla, Firebase usará persistencia por defecto.
  }
}

export const loginConCorreo = async (email: string, password: string) => {
  try {
    await ensurePersistence();
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred; // { user, ... }
  } catch (err: any) {
    throw new Error(normalizeAuthError(err?.code));
  }
};

export const registroConCorreo = async (email: string, password: string) => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return cred;
  } catch (err: any) {
    throw new Error(normalizeAuthError(err?.code));
  }
};



export const loginConGoogle = async () => {
  try {
    await ensurePersistence();
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    return cred;
  } catch (err: any) {
    throw new Error(normalizeAuthError(err?.code));
  }
};

export const cerrarSesion = async () => {
  try {
    await signOut(auth);
  } catch (err: any) {
    throw new Error(normalizeAuthError(err?.code));
  }
};

export const resetPassword = async (email: string) => {
  if (!email) throw new Error("Email es requerido");
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err: any) {
    throw new Error(normalizeAuthError(err?.code));
  }
};
