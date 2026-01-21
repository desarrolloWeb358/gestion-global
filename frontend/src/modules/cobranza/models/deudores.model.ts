    // src/modules/cobranza/models/deudor.model.ts
    import { FieldValue, Timestamp } from "firebase/firestore";
    import { AcuerdoPago } from "./acuerdoPago.model";
    import { EstadoMensual } from "./estadoMensual.model";
    import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";


    export interface Deudor {
    id?: string;
    uidUsuario?: string;
    ubicacion?: string;
    fechaCreacion?: Timestamp | { seconds: number; nanoseconds: number } | FieldValue;
    nombre: string;
    cedula?: string;
    correos: string[];
    telefonos: string[];
    direccion?: string;
    tipificacion: TipificacionDeuda;
    porcentajeHonorarios?: number;
    estadoMensual?: EstadoMensual[];
    acuerdoActivoId?: string;
    historialAcuerdos?: AcuerdoPago[];

    fechaTerminado?: Timestamp | { seconds: number; nanoseconds: number } | Date | FieldValue | null;

    demandados?: string; 
    juzgado?: string; 
    numeroRadicado?: string; 
    localidad?: string; 
    observacionesDemanda?: string;
    observacionesDemandaCliente?: string; 


    juzgadoId?: string;
    numeroProceso?: string;
    anoProceso?: number;

    fechaUltimaRevision?: Timestamp | { seconds: number; nanoseconds: number } | Date | FieldValue | null;
    }