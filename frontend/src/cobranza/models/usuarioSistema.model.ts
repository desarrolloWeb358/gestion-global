export interface UsuarioSistema {
    uid: string;
    email: string;
    rol: 'admin' | 'cliente' | 'inmueble';
    asociadoA?: string;
    nombre?: string;
    fecha_registro?: string;
    activo?: boolean;
  }