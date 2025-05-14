export interface Cliente {
    id?: string;
    nombre: string;
    correo: string;
    tipo: "natural" | "jurídica" | ""; // permite cadena vacía
    telefono: string;
    direccion: string;
  }
  