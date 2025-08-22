// models/cliente.model.ts
export interface Cliente {
  id?: string;  

  // datos propios del cliente
  nombre: string;
  direccion?: string;
  banco?: string;
  numeroCuenta?: string;
   tipoCuenta?: "ahorros" | "corriente" | "convenio" | ""; 

  // referencias (uids) a usuarios del sistema
  ejecutivoPrejuridicoId?: string | null;
  ejecutivoJuridicoId?: string | null;

  activo?: boolean;
  // si necesitas relacionarlo con un UsuarioSistema “propietario”
  usuarioUid?: string | null;
}
