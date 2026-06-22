// src/modules/usuarios/services/deudorUserService.ts
import { db } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { crearUsuarioDesdeAdmin } from "@/shared/services/crearUsuarioService"; // ajusta ruta real

type CrearUsuarioDeudorInput = {
  email: string;
  nombre?: string;
  clienteId: string;
  deudorId: string;
  numeroDocumento: string; // contraseña (mín 6)
};

export async function crearUsuarioParaDeudor({
  email,
  nombre,
  clienteId,
  deudorId,
  numeroDocumento,
}: CrearUsuarioDeudorInput): Promise<UsuarioSistema> {
  const password = numeroDocumento;

  if (!password || password.length < 6) {
    throw new Error(
      "El número de documento es muy corto para usarlo como contraseña (mínimo 6 caracteres)."
    );
  }

  // 1) Crear en Auth desde Admin (NO cambia sesión)
  const { uid } = await crearUsuarioDesdeAdmin({
    email,
    password,
    nombre: nombre ?? "",
    roles: ["deudor"],          // 👈 manda el rol real
    activo: true,    
    clienteIdAsociado: clienteId,
    deudorIdAsociado: deudorId,
    numeroDocumento,
    tipoDocumento: "CC",
  });

  // 2) Guardar perfil en Firestore (si tu Function NO lo guarda)
  const usuarioSistema: UsuarioSistema = {
    uid,
    email,
    nombre,
    roles: ["deudor"],
    clienteIdAsociado: clienteId,
    deudorIdAsociado: deudorId,
    numeroDocumento,
    tipoDocumento: "CC",
  };

  return usuarioSistema;
}
