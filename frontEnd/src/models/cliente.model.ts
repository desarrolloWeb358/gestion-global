export interface Cliente {
    id?: string;
    nombre: string;
    correo: string;
    tipo: 'natural' | 'jurídica';
    telefono: string;
    direccion: string;
    fecha_creacion: string;
  }
  