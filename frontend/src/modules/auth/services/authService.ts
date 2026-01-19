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

import { normalizeAuthError } from "../utils/authErrors";
import { AuthAppError } from "../utils/authAppError";

async function ensurePersistence() {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    // fallback silencioso
  }
}

export const loginConCorreo = async (email: string, password: string) => {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (err: any) {
    throw new AuthAppError(normalizeAuthError(err?.code), err?.code);
  }
};

export const registroConCorreo = async (email: string, password: string) => {
  try {
    return await createUserWithEmailAndPassword(auth, email, password);
  } catch (err: any) {
    throw new AuthAppError(normalizeAuthError(err?.code), err?.code);
  }
};

export const loginConGoogle = async () => {
  try {
    await ensurePersistence();
    const provider = new GoogleAuthProvider();
    return await signInWithPopup(auth, provider);
  } catch (err: any) {
    throw new AuthAppError(normalizeAuthError(err?.code), err?.code);
  }
};

export const cerrarSesion = async () => {
  try {
    await signOut(auth);
  } catch (err: any) {
    throw new AuthAppError(normalizeAuthError(err?.code), err?.code);
  }
};

export const resetPassword = async (email: string) => {
  if (!email) throw new Error("Email es requerido");
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err: any) {
    throw new AuthAppError(normalizeAuthError(err?.code), err?.code);
  }
};
