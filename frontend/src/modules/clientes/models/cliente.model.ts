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
  dependienteAbogadoId?: string | null;

  activo?: boolean;

  // Franquicia / sucursal a la que pertenece el conjunto (1:1).
  // Opcional por compatibilidad: si falta, se trata como "bogota".
  franquiciaId?: string;
  // Ciudad del conjunto; debe pertenecer a franquicia.ciudades.
  ciudad?: string;

  // Meses habilitados para que el rol cliente pueda ver el reporte (formato "YYYY-MM")
  reportesHabilitados?: Record<string, boolean>;
}
