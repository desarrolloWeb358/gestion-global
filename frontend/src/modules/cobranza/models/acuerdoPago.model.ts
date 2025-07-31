import { Timestamp } from "firebase/firestore";

export interface Cuota {
  numero: number;                  // Ej: 1, 2, 3...
  fechaPago: Timestamp;          // Fecha límite de pago
  valor: number;                  // Total acordado por cuota
  pagado?: boolean;               // Se marcó como pagada o no
  observacion?: string;           // Por si se hace una nota del pago
}

export interface AcuerdoPago {
  id?: string;                    // ID del documento en Firestore
  numero: string;                 // Código único o consecutivo (ej: "AC-2024-001")
  fechaCreacion: Timestamp;      // Fecha en que se creó el acuerdo
  tipo: 'fijo' | 'variable';       // Tipo de cuotas (mismo valor o valores distintos)
  descripcion: string;            // Detalles o condiciones generales del acuerdo
  valorTotal: number;            // Suma total del acuerdo (capital + honorarios)
  porcentajeHonorarios?: number; // Opcional: si aplica honorarios
  cuotas: Cuota[];               // Lista de cuotas definidas
  archivoUrl?: string;            // Documento PDF o imagen del acuerdo
}
