// models/cliente.model.ts
export interface Cliente {
  id?: string;

  // ⚠️ Se elimina 'nombre' del cliente: ahora se toma del documento de UsuarioSistema
  direccion?: string;
  banco?: string;
  numeroCuenta?: string;
  tipoCuenta?: "ahorros" | "corriente" | "convenio" | "";

  // referencias (uids) a usuarios del sistema
  ejecutivoPrejuridicoId?: string | null;
  ejecutivoJuridicoId?: string | null;

  // Usuario “propietario” del cliente (de aquí se toma el nombre, teléfono y email)
  usuarioUid?: string | null;

  activo?: boolean;
}
