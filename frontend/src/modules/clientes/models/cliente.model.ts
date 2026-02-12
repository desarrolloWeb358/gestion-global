// models/cliente.model.ts
export interface Cliente {
  id?: string;

  nombre?: string;
  direccion?: string;
  administrador?: string;
  banco?: string;
  numeroCuenta?: string;
  tipoCuenta?: "ahorros" | "corriente" | "convenio" | "";

  // referencias (uids) a usuarios del sistema
  ejecutivoPrejuridicoId?: string | null;
  ejecutivoJuridicoId?: string | null;
  ejecutivoDependienteId?: string | null;
  abogadoId?: string | null;

  activo?: boolean;
}
