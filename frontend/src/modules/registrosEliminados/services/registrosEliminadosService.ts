import { db } from "@/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import type { RegistroEliminado } from "@/shared/services/auditLog/auditLogModel";

export const obtenerRegistrosEliminados = async (): Promise<RegistroEliminado[]> => {
  const q = query(
    collection(db, "registrosEliminados"),
    orderBy("fechaEliminacion", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RegistroEliminado));
};
