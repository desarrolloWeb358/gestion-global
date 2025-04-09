// src/services/dashboardService.ts
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../../firebase";

export const contarClientes = async (): Promise<number> => {
  const snapshot = await getDocs(collection(db, "clientes"));
  return snapshot.size;
};

export const contarUsuarios = async (): Promise<number> => {
  const snapshot = await getDocs(collection(db, "usuarios"));
  return snapshot.size;
};

export const contarInmuebles = async (): Promise<number> => {
  const snapshot = await getDocs(collection(db, "inmuebles"));
  return snapshot.size;
};

export const contarDeudores = async (): Promise<number> => {
  const snapshot = await getDocs(collection(db, "deudores"));
  return snapshot.size;
};
