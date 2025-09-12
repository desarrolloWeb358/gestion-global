import { Timestamp, FieldValue } from "firebase/firestore";
import { AcuerdoPago } from "./acuerdoPago.model";
import { EstadoMensual } from './estadoMensual.model';
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";
// Ahora podemos usarlo en acuerdo_pago e historial_acuerdos
export interface Deudor {
  uidUsuario(uidUsuario: any): unknown;
 id?: string;
  ubicacion?: string;
  fechaCreacion?: Timestamp | { seconds: number; nanoseconds: number } | FieldValue;
  nombre: string;
  cedula?: string;
  correos: string[];
  telefonos: string[];
  direccion?: string;          // Ej: prejurídico, jurídico, en acuerdo, etc.
  tipificacion: TipificacionDeuda;     // Ej: acuerdo vigente, en mora, etc.
  porcentajeHonorarios?: number; // Porcentaje de honorarios aplicable
  
  estadoMensual?: EstadoMensual[];         // Estado mensual de la deuda

  // Referencias para trazabilidad (no almacenar el acuerdo completo aquí)
  acuerdoActivoId?: string;
  historialAcuerdos?: AcuerdoPago[]; // Lista de acuerdos previos
  
  // para llevar el control del proceso juridico
  juzgadoId?: string;
  numeroProceso?: string;
  anoProceso?: number;
 

}


 