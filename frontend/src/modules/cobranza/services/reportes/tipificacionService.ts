// src/modules/cobranza/services/reportes/tipificacionService.ts

import { db } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";
import { TipificacionDeuda } from "../../../../shared/constants/tipificacionDeuda"; 
// ^ ajusta la ruta según donde tengas el enum

// Usamos los valores del enum como tipo
export type TipificacionKey = TipificacionDeuda;

export interface PieItem {
  name: TipificacionKey;
  value: number;
}

// Solo las categorías que quieres graficar (puedes incluir INACTIVO si quieres)
const CATEGORIAS: TipificacionKey[] = [
  TipificacionDeuda.DEVUELTO,
  TipificacionDeuda.TERMINADO,
  TipificacionDeuda.ACUERDO,
  TipificacionDeuda.GESTIONANDO,
  TipificacionDeuda.DEMANDA,
  TipificacionDeuda.DEMANDAACUERDO,
  // TipificacionDeuda.INACTIVO, // si algún día lo quieres mostrar
];

/**
 * Lee clientes/{clienteId}/deudores y cuenta por 'tipificacion'
 */
export async function contarTipificacionPorCliente(
  clienteId: string
): Promise<PieItem[]> {
  const ref = collection(db, `clientes/${clienteId}/deudores`);
  const snap = await getDocs(ref);

  const counts = new Map<TipificacionKey, number>();
  CATEGORIAS.forEach((c) => counts.set(c, 0));

  snap.forEach((doc) => {
    const data = doc.data() as { tipificacion?: string };

    const raw = String(data.tipificacion ?? "").trim();

    let cat: TipificacionKey | undefined;

    // 1) Si el valor en BD ya coincide EXACTO con algún valor del enum
    if (Object.values(TipificacionDeuda).includes(raw as TipificacionDeuda)) {
      cat = raw as TipificacionKey;
    } else {
      // 2) Fallback por si hay valores viejos/variantes
      const upper = raw.toUpperCase();

      if (upper.includes("DEMANDA") && upper.includes("ACUERDO")) {
        cat = TipificacionDeuda.DEMANDAACUERDO;
      } else if (upper.includes("GESTION")) {
        cat = TipificacionDeuda.GESTIONANDO;
      } else if (upper.includes("DEVUEL")) {
        cat = TipificacionDeuda.DEVUELTO;
      } else if (upper.includes("ACUERD")) {
        cat = TipificacionDeuda.ACUERDO;
      } else if (upper.includes("TERMIN")) {
        cat = TipificacionDeuda.TERMINADO;
      } else if (upper.includes("DEMANDA")) {
        cat = TipificacionDeuda.DEMANDA;
      }
    }

    const finalCat = cat ?? TipificacionDeuda.GESTIONANDO; // default

    counts.set(finalCat, (counts.get(finalCat) || 0) + 1);
  });

  return CATEGORIAS.map((name) => ({
    name,
    value: counts.get(name) || 0,
  }));
}
