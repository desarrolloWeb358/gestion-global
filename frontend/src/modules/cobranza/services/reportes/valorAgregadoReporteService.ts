import { getDocs, collection, Timestamp } from "firebase/firestore";
import { db } from "@/firebase";
import { TipoValorAgregado, TipoValorAgregadoLabels } from "@/shared/constants/tipoValorAgregado";

export interface ValorAgregadoReporteItem {
  id: string;
  titulo: string;
  tipo: TipoValorAgregado;
  tipoLabel: string;
  fechaSolicitado: Date | null;
  fechaEntregado: Date | null;
  archivos: { nombre: string; url: string }[];
  completado: boolean;
}

export type ValoresAgregadosPorTipo = {
  tipo: TipoValorAgregado;
  tipoLabel: string;
  items: ValorAgregadoReporteItem[];
};

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "object" && typeof v.seconds === "number")
    return new Date(v.seconds * 1000);
  return null;
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export { fmtDate };

export async function obtenerValoresAgregadosReporte(
  clienteId: string,
  year: number,
  month: number,
  soloEntregados = false
): Promise<ValoresAgregadosPorTipo[]> {
  const snap = await getDocs(
    collection(db, `clientes/${clienteId}/valoresAgregados`)
  );

  const items: ValorAgregadoReporteItem[] = [];

  snap.forEach((d) => {
    const data = d.data() as any;
    const fechaSolicitado = toDate(data.fecha);

    if (!fechaSolicitado) return;
    if (
      fechaSolicitado.getFullYear() !== year ||
      fechaSolicitado.getMonth() + 1 !== month
    )
      return;

    const completado = !!data.completado || !!toDate(data.fechaCompletado);
    if (soloEntregados && !completado) return;

    const archivosRaw: any[] = data.archivos ?? [];
    const archivos =
      archivosRaw.length > 0
        ? archivosRaw.map((a: any) => ({ nombre: a.nombre ?? "", url: a.url ?? "" }))
        : data.archivoURL
        ? [{ nombre: data.archivoNombre ?? "Archivo", url: data.archivoURL }]
        : [];

    items.push({
      id: d.id,
      titulo: data.titulo ?? "",
      tipo: data.tipo as TipoValorAgregado,
      tipoLabel: TipoValorAgregadoLabels[data.tipo as TipoValorAgregado] ?? data.tipo,
      fechaSolicitado,
      fechaEntregado: toDate(data.fechaCompletado),
      archivos,
      completado,
    });
  });

  // Agrupar por tipo manteniendo el orden del enum
  const order = Object.values(TipoValorAgregado);
  const map = new Map<TipoValorAgregado, ValorAgregadoReporteItem[]>();
  order.forEach((t) => map.set(t, []));

  items.forEach((item) => {
    const bucket = map.get(item.tipo);
    if (bucket) bucket.push(item);
    else map.set(item.tipo, [item]);
  });

  const result: ValoresAgregadosPorTipo[] = [];
  map.forEach((list, tipo) => {
    if (list.length === 0) return;
    list.sort((a, b) => (a.fechaSolicitado?.getTime() ?? 0) - (b.fechaSolicitado?.getTime() ?? 0));
    result.push({ tipo, tipoLabel: TipoValorAgregadoLabels[tipo] ?? tipo, items: list });
  });

  return result;
}
