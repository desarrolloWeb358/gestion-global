import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export function useAcuerdoData(clienteId: string, deudorId: string) {
  const [data, setData] = useState<{
    deudor: any;
    cliente: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!clienteId || !deudorId) {
        setLoading(false);
        return;
      }

      try {
        const clienteSnap = await getDoc(doc(db, "clientes", clienteId));
        const deudorSnap = await getDoc(doc(db, "clientes", clienteId, "deudores", deudorId));

        if (!clienteSnap.exists() || !deudorSnap.exists()) {
          setData(null);
        } else {
          setData({
            cliente: { id: clienteSnap.id, ...clienteSnap.data() },
            deudor: { id: deudorSnap.id, ...deudorSnap.data() },
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
  }, [clienteId, deudorId]);

  // 👇 ESTA LÍNEA ES CRUCIAL
  return { data, loading };
}
