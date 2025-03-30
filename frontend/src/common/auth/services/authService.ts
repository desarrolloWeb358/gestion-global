// src/common/auth/services/authService.ts
import { auth } from "../../../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";

export const loginConCorreo = async (email: string, password: string) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

export const registroConCorreo = async (email: string, password: string) => {
  return await createUserWithEmailAndPassword(auth, email, password);
};

export const loginConGoogle = async () => {
  const provider = new GoogleAuthProvider();
  return await signInWithPopup(auth, provider);
};

export const cerrarSesion = async () => {
  return await signOut(auth);
};
