import { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";

export interface Cliente extends UsuarioSistema {
  
  id?: string;
  direccion: string;
  banco: string;
  numeroCuenta: string;
  tipoCuenta: "ahorros" | "corriente" | "convenio" | "";
  ejecutivoPrejuridicoId: string;
  ejecutivoJuridicoId: string;
}