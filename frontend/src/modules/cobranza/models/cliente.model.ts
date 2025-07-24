export interface Cliente {
   id?: string; 
  nombre: string;
  correo: string;
  telefono: string;
  direccion: string;
  banco: string;
  numeroCuenta: string;
  tipoCuenta: "ahorros" | "corriente" | "convenio" | "";
  honorarioPorcentaje?: number;
   ejecutivoId: string;
}
