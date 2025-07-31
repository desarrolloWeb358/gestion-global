import { Timestamp, FieldValue } from "firebase/firestore";

// Ahora podemos usarlo en acuerdo_pago e historial_acuerdos
export interface Deudor { 
  
  id?: string;
  ubicacion?: string;
  fechaCreacion?: Timestamp | { seconds: number; nanoseconds: number } | FieldValue;
  nombre: string;
  cedula?: string;
  correos: string[];
  telefonos: string[];
  estado: string;           // Ej: prejurídico, jurídico, en acuerdo, etc.
  tipificacion: string;     // Ej: acuerdo vigente, en mora, etc.
  deuda?: number;
  deudaTotal?: number;
  porcentajeHonorarios?: number;
  totalRecaudado?: number;

  // Referencias para trazabilidad (no almacenar el acuerdo completo aquí)
  acuerdoActivoId?: string;
  
  // para llevar el control del proceso juridico
  juzgadoId?: string;
  numeroProceso?: string;
  anoProceso?: number;
 

}


 