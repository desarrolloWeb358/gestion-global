// src/hooks/useEjecutivoChartData.ts
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { Inmueble } from "../modules/cobranza/models/inmueble.model";
import { ChartBarData } from "../components/ui/chart-bar-interactive";

export function useEjecutivoChartData(ejecutivoEmail: string | null) {
  const [data, setData] = useState<ChartBarData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ejecutivoEmail) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const inmueblesRef = collection(db, "inmuebles");
        const q = query(inmueblesRef, where("ejecutivoEmail", "==", ejecutivoEmail));
        const snapshot = await getDocs(q);

        const datos: Record<string, { recaudo: number; honorarios: number }> = {};

        snapshot.forEach((doc) => {
          const inmueble = doc.data() as Inmueble;
          const recaudos = inmueble.recaudos ?? {};

          const porcentaje =
            inmueble.acuerdo_pago?.porcentajeHonorarios ??
            inmueble.porcentaje_honorarios ??
            0.11;

          Object.entries(recaudos).forEach(([mes, detalle]: any) => {
            if (!datos[mes]) {
              datos[mes] = { recaudo: 0, honorarios: 0 };
            }

            datos[mes].recaudo += detalle.monto;
            datos[mes].honorarios += detalle.monto * porcentaje;
          });
        });

        const resultado: ChartBarData[] = Object.entries(datos)
          .map(([date, valores]) => ({ date, ...valores }))
          .sort((a, b) => a.date.localeCompare(b.date));

        setData(resultado);
      } catch (error) {
        console.error("Error al obtener datos del ejecutivo:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [ejecutivoEmail]);

  return { data, loading };
}
