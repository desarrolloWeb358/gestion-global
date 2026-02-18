// models/cliente.model.ts
export interface Cliente {
  id?: string;

  nombre?: string;
  direccion?: string;
  administrador?: string;
  formaPago?: string;  
  
  // referencias (uids) a usuarios del sistema
  ejecutivoPrejuridicoId?: string | null;
  ejecutivoJuridicoId?: string | null;
  ejecutivoDependienteId?: string | null;
  abogadoId?: string | null;

  activo?: boolean;
}
