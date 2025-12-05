// src/modules/usuarios/services/deudorUserService.ts
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";

type CrearUsuarioDeudorInput = {
  email: string;
  nombre?: string;
  clienteId: string;
  deudorId: string;
  numeroDocumento: string; // 👈 cédula (password)
};

export async function crearUsuarioParaDeudor({
  email,
  nombre,
  clienteId,
  deudorId,
  numeroDocumento,
}: CrearUsuarioDeudorInput): Promise<UsuarioSistema> {
  const password = numeroDocumento; // 👈 contraseña = cédula

  if (!password || password.length < 6) {
    throw new Error(
      "El número de documento es muy corto para usarlo como contraseña (mínimo 6 caracteres)."
    );
  }

  console.log("[crearUsuarioParaDeudor] Creando usuario:", {
    email,
    password,
    clienteId,
    deudorId,
  });

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  const usuarioSistema: UsuarioSistema = {
    uid,
    email,
    nombre,
    roles: ["deudor"],
    clienteIdAsociado: clienteId,
    deudorIdAsociado: deudorId,
    numeroDocumento,
    tipoDocumento: "CC", // 👈 aquí el valor por defecto
  };
  await setDoc(doc(db, "usuarios", uid), usuarioSistema);

  console.log(
    "[crearUsuarioParaDeudor] UsuarioSistema guardado:",
    usuarioSistema
  );

  return usuarioSistema;
}
