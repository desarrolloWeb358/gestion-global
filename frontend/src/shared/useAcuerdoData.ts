// src/shared/useAcuerdoData.ts
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export function useAcuerdoData(clienteId: string, inmuebleId: string) {
  const [data, setData] = useState<{
    cliente: any;
    inmueble: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const clienteSnap = await getDoc(doc(db, "clientes", clienteId));
        console.log("clienteId:", clienteId);
        console.log("inmuebleId:", inmuebleId);
        const inmuebleSnap = await getDoc(
          doc(db, "clientes", clienteId, "inmuebles", inmuebleId)
        );

        if (!clienteSnap.exists() || !inmuebleSnap.exists()) {
          setData(null);
        } else {
          setData({
            cliente: { id: clienteSnap.id, ...clienteSnap.data() },
            inmueble: { id: inmuebleSnap.id, ...inmuebleSnap.data() },
          });
        }
      } catch (err) {
        console.error("Error cargando datos del acuerdo:", err);
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [clienteId, inmuebleId]);

  return { data, loading };
}
