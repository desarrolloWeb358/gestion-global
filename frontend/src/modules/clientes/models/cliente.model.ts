// models/cliente.model.ts
import type { Timestamp } from "firebase/firestore";

export interface Cliente {
  id?: string;

  nombre?: string;
  direccion?: string;
  administrador?: string;
  // El correo del conjunto es el de acceso del usuario (`usuarios/{id}.email`);
  // no se duplica aquí para que "Cambiar correo" no deje copias obsoletas.
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

  // === Bloqueo del portal por no pago del servicio ===
  // Lo activa/levanta el ejecutivo (o ejecutivoAdmin) desde la página del cliente.
  // Con `true`, el rol `cliente` sigue entrando a su página pero no puede abrir
  // ninguno de los accesos rápidos: ve un aviso para contactar a su ejecutivo.
  // Es independiente de `activo` (ese sí bloquea el ingreso al sistema).
  bloqueadoPorPago?: boolean;
  bloqueoPagoMotivo?: string;
  bloqueoPagoFecha?: Timestamp;
  bloqueoPagoPor?: string;        // uid de quien lo bloqueó
  bloqueoPagoPorNombre?: string;  // nombre para mostrarlo sin resolver el uid
}
