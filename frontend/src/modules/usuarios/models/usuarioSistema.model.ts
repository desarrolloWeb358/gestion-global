export interface UsuarioSistema {
    uid: string;
    email: string;
    rol: 'admin' | 'ejecutivo' | 'cliente' | 'inmueble';
    asociadoA?: string;
    nombre?: string;
    fecha_registro?: string;
    activo?: boolean;
  }