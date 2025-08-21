import { db } from "@/firebase";
import { collection, getDocs } from "firebase/firestore";

export type TipificacionKey =
  | "Demanda"
  | "Demanda/Acuerdo"
  | "Gestionando"
  | "Acuerdo"
  | "Terminado"
  | "Devuelto";

const CATEGORIAS: TipificacionKey[] = [
  "Demanda",
  "Demanda/Acuerdo",
  "Gestionando",
  "Acuerdo",
  "Terminado",
  "Devuelto",
];

export interface PieItem {
  name: string;
  value: number;
}

/**
 * Lee clientes/{clienteId}/inmuebles y cuenta por 'tipificacion'
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
    const raw = (data.tipificacion || "").toUpperCase().trim();

    // Normaliza variantes comunes (ajusta si tienes nombres distintos)
    let cat: TipificacionKey | undefined = CATEGORIAS.find((c) => c === raw);
    if (!cat && raw.includes("Demanda") && raw.includes("Acuerdo")) cat = "Demanda/Acuerdo";
    if (!cat && raw.includes("GESTION")) cat = "Gestionando";
    if (!cat && raw.includes("DEVUEL")) cat = "Devuelto";
    if (!cat && raw.includes("ACUERD")) cat = "Acuerdo";
    if (!cat && raw.includes("TERMIN")) cat = "Terminado";
    if (!cat && raw === "Demanda") cat = "Demanda";

    counts.set((cat ?? "Gestionando"), (counts.get(cat ?? "Gestionando") || 0) + 1);
  });

  return CATEGORIAS.map((name) => ({ name, value: counts.get(name) || 0 }));
}
