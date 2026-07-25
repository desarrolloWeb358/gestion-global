// modules/cobranza/services/reportes/demandaReporteGlobalService.ts
import { db } from "@/firebase";
import { collection, collectionGroup, getDocs } from "firebase/firestore";
import { Demanda, toDateSafe } from "../../models/demanda.model";

export interface DemandaReporteRow {
  demandaId: string;
  clienteId: string;
  clienteNombre: string;
  deudorId: string;
  deudorNombre: string;
  ubicacion: string;
  numeroRadicado: string;
  juzgado: string;
  localidad: string;
  estado: Demanda["estado"];
  ejecutivoDependienteId: string | null;
  ejecutivoDependienteNombre: string;
  etiquetas: { nombre: string; detalle: string; fecha: Date | null }[];
  proximaAccionFecha: Date | null;
  fechaUltimaRevision: Date | null;
  fechaCreacion: Date | null;
  totalDemandados: number;
  notificacionesSinCoteje: number;
}

export interface DemandaReporteFiltros {
  clienteId?: string;
  ejecutivoDependienteId?: string;
  estado?: Demanda["estado"];
  etiquetaNombre?: string;
  soloSinCoteje?: boolean;
  // Rango sobre el campo elegido
  campoFecha?: "fechaUltimaRevision" | "fechaCreacion" | "proximaAccionFecha";
  desde?: Date;
  hasta?: Date;
}

/** Carga el mapa clienteId → { nombre, ejecutivoDependienteId } (clientes es pequeño). */
async function cargarMapasClientesYusuarios() {
  const [clientesSnap, usuariosSnap] = await Promise.all([
    getDocs(collection(db, "clientes")),
    getDocs(collection(db, "usuarios")),
  ]);

  const clientes = new Map<string, { nombre: string; depId: string | null }>();
  clientesSnap.docs.forEach((d) => {
    const data = d.data();
    clientes.set(d.id, {
      nombre: (data.nombre as string) ?? d.id,
      depId: (data.ejecutivoDependienteId as string | null) ?? null,
    });
  });

  const usuarios = new Map<string, string>();
  usuariosSnap.docs.forEach((d) => {
    const data = d.data();
    usuarios.set(d.id, (data.nombre as string) ?? (data.email as string) ?? d.id);
  });

  return { clientes, usuarios };
}

/**
 * Reporte global de demandas: recorre collectionGroup("demandas"), resuelve cliente
 * (nombre + dependiente) en memoria y aplica filtros. Filtros y orden se resuelven aquí.
 */
export async function obtenerReporteDemandas(
  filtros: DemandaReporteFiltros = {}
): Promise<DemandaReporteRow[]> {
  const [{ clientes, usuarios }, demandasSnap] = await Promise.all([
    cargarMapasClientesYusuarios(),
    getDocs(collectionGroup(db, "demandas")),
  ]);

  const rows: DemandaReporteRow[] = [];

  for (const docSnap of demandasSnap.docs) {
    const data = docSnap.data() as Demanda;
    // El cliente puede venir denormalizado o derivarse de la ruta
    const clienteId =
      (data.clienteId as string) ??
      docSnap.ref.parent.parent?.parent.parent?.id ??
      "";
    const deudorId =
      (data.deudorId as string) ?? docSnap.ref.parent.parent?.id ?? "";

    const cli = clientes.get(clienteId);
    const depId = cli?.depId ?? null;

    const notificacionesSinCoteje = (data.demandados ?? []).reduce(
      (acc, d) =>
        acc + (d.notificaciones ?? []).filter((n) => !n.coteje).length,
      0
    );

    rows.push({
      demandaId: docSnap.id,
      clienteId,
      clienteNombre: cli?.nombre ?? clienteId,
      deudorId,
      deudorNombre: (data.deudorNombre as string) ?? "",
      ubicacion: (data.ubicacion as string) ?? "",
      numeroRadicado: data.numeroRadicado ?? "",
      juzgado: data.juzgado ?? "",
      localidad: data.localidad ?? "",
      estado: data.estado ?? "activa",
      ejecutivoDependienteId: depId,
      ejecutivoDependienteNombre: depId ? usuarios.get(depId) ?? depId : "",
      etiquetas: (data.etiquetas ?? []).map((e) => ({
        nombre: e.nombre,
        detalle: e.detalle,
        fecha: toDateSafe(e.fecha),
      })),
      proximaAccionFecha: toDateSafe(data.proximaAccionFecha),
      fechaUltimaRevision: toDateSafe(data.fechaUltimaRevision),
      fechaCreacion: toDateSafe(data.fechaCreacion),
      totalDemandados: (data.demandados ?? []).length,
      notificacionesSinCoteje,
    });
  }

  return aplicarFiltros(rows, filtros);
}

function aplicarFiltros(
  rows: DemandaReporteRow[],
  f: DemandaReporteFiltros
): DemandaReporteRow[] {
  const desde = f.desde ? new Date(new Date(f.desde).setHours(0, 0, 0, 0)).getTime() : undefined;
  const hasta = f.hasta ? new Date(new Date(f.hasta).setHours(23, 59, 59, 999)).getTime() : undefined;
  const campo = f.campoFecha ?? "fechaUltimaRevision";

  return rows
    .filter((r) => (f.clienteId ? r.clienteId === f.clienteId : true))
    .filter((r) =>
      f.ejecutivoDependienteId ? r.ejecutivoDependienteId === f.ejecutivoDependienteId : true
    )
    .filter((r) => (f.estado ? r.estado === f.estado : true))
    .filter((r) =>
      f.etiquetaNombre ? r.etiquetas.some((e) => e.nombre === f.etiquetaNombre) : true
    )
    .filter((r) => (f.soloSinCoteje ? r.notificacionesSinCoteje > 0 : true))
    .filter((r) => {
      if (desde === undefined && hasta === undefined) return true;
      const d = r[campo] as Date | null;
      if (!d) return false;
      const ms = d.getTime();
      if (desde !== undefined && ms < desde) return false;
      if (hasta !== undefined && ms > hasta) return false;
      return true;
    })
    .sort((a, b) => {
      // Orden por acción más próxima; los sin fecha al final
      const av = a.proximaAccionFecha?.getTime() ?? Infinity;
      const bv = b.proximaAccionFecha?.getTime() ?? Infinity;
      return av - bv;
    });
}
