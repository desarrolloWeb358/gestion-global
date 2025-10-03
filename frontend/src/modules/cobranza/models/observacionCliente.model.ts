import { Timestamp } from "firebase/firestore";

export interface ObservacionCliente {
  id?: string;
  texto: string;
  fecha: Timestamp;    
  autorUid: string;  
}