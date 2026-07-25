// modules/cobranza/services/reportes/demandaReporteGlobalService.ts
import { db } from "@/firebase";
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
  QueryDocumentSnapshot,
} from "firebase/firestore";
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

type ClientesMap = Map<string, { nombre: string; depId: string | null }>;
type UsuariosMap = Map<string, string>;

/** Carga el mapa clienteId → { nombre, ejecutivoDependienteId } (clientes es pequeño). */
async function cargarMapasClientesYusuarios(): Promise<{
  clientes: ClientesMap;
  usuarios: UsuariosMap;
}> {
  const [clientesSnap, usuariosSnap] = await Promise.all([
    getDocs(collection(db, "clientes")),
    getDocs(collection(db, "usuarios")),
  ]);

  const clientes: ClientesMap = new Map();
  clientesSnap.docs.forEach((d) => {
    const data = d.data();
    clientes.set(d.id, {
      nombre: (data.nombre as string) ?? d.id,
      depId: (data.ejecutivoDependienteId as string | null) ?? null,
    });
  });

  const usuarios: UsuariosMap = new Map();
  usuariosSnap.docs.forEach((d) => {
    const data = d.data();
    usuarios.set(d.id, (data.nombre as string) ?? (data.email as string) ?? d.id);
  });

  return { clientes, usuarios };
}

/**
 * Opciones para poblar los filtros SIN leer demandas (colecciones pequeñas).
 * Devuelve clientes, dependientes (los que tienen clientes asignados) y etiquetas.
 */
export async function cargarOpcionesFiltroDemandas(): Promise<{
  clientes: { id: string; nombre: string }[];
  dependientes: { id: string; nombre: string }[];
}> {
  const { clientes, usuarios } = await cargarMapasClientesYusuarios();

  const clientesArr = [...clientes.entries()]
    .map(([id, v]) => ({ id, nombre: v.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const depIds = new Set<string>();
  clientes.forEach((v) => v.depId && depIds.add(v.depId));
  const dependientes = [...depIds]
    .map((id) => ({ id, nombre: usuarios.get(id) ?? id }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return { clientes: clientesArr, dependientes };
}

function docToRow(
  docSnap: QueryDocumentSnapshot,
  clientes: ClientesMap,
  usuarios: UsuariosMap
): DemandaReporteRow {
  const data = docSnap.data() as Demanda;
  const clienteId =
    (data.clienteId as string) ??
    docSnap.ref.parent.parent?.parent.parent?.id ??
    "";
  const deudorId = (data.deudorId as string) ?? docSnap.ref.parent.parent?.id ?? "";

  const cli = clientes.get(clienteId);
  const depId = cli?.depId ?? null;

  const notificacionesSinCoteje = (data.demandados ?? []).reduce(
    (acc, d) => acc + (d.notificaciones ?? []).filter((n) => !n.coteje).length,
    0
  );

  return {
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
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Busca demandas acotando la consulta al servidor por `clienteId` (denormalizado
 * en cada demanda) cuando hay cliente o dependiente seleccionado. Así NO se leen
 * todas las demandas de la base. El resto de filtros (etiqueta, fecha, coteje) se
 * aplican en memoria sobre el conjunto ya reducido.
 *
 * Regla de acotamiento:
 *  - clienteId → [ese cliente]
 *  - dependiente → todos sus clientes (cliente.ejecutivoDependienteId)
 *  - si no hay ninguno pero sí `estado` → consulta por estado (más liviana que todo)
 *  - si no hay nada acotable → lee todas (caso explícito, evitar en lo posible)
 */
export async function buscarDemandas(
  filtros: DemandaReporteFiltros = {}
): Promise<DemandaReporteRow[]> {
  const { clientes, usuarios } = await cargarMapasClientesYusuarios();

  // 1) Determinar clienteIds objetivo
  let targetClienteIds: string[] | null = null;
  if (filtros.clienteId) {
    targetClienteIds = [filtros.clienteId];
  } else if (filtros.ejecutivoDependienteId) {
    targetClienteIds = [...clientes.entries()]
      .filter(([, v]) => v.depId === filtros.ejecutivoDependienteId)
      .map(([id]) => id);
    if (targetClienteIds.length === 0) return [];
  }

  // 2) Ejecutar consultas acotadas
  let docs: QueryDocumentSnapshot[] = [];
  if (targetClienteIds) {
    // Firestore 'in' admite hasta 30 valores → dividir en lotes
    const lotes = chunk(targetClienteIds, 30);
    const snaps = await Promise.all(
      lotes.map((ids) =>
        getDocs(query(collectionGroup(db, "demandas"), where("clienteId", "in", ids)))
      )
    );
    docs = snaps.flatMap((s) => s.docs);
  } else if (filtros.estado) {
    const snap = await getDocs(
      query(collectionGroup(db, "demandas"), where("estado", "==", filtros.estado))
    );
    docs = snap.docs;
  } else {
    const snap = await getDocs(collectionGroup(db, "demandas"));
    docs = snap.docs;
  }

  const rows = docs.map((d) => docToRow(d, clientes, usuarios));
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
