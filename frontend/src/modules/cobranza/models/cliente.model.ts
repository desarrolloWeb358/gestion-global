import { UsuarioSistema } from "../../usuarios/models/usuarioSistema.model";

export interface Cliente extends UsuarioSistema {
  id?: string; // si lo manejas separado del uid de Firebase
  direccion: string;
  banco: string;
  numeroCuenta: string;
  tipoCuenta: "ahorros" | "corriente" | "convenio" | "";
  honorarioPorcentaje?: number;
  ejecutivoId: string;
}