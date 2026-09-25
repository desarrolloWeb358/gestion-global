// modules/cobranza/services/reportes/demandaReporteGlobalService.ts
import { db } from "@/firebase";
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
  documentId,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { Demanda, toDateSafe } from "../../models/demanda.model";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";

export interface DemandaReporteRow {
  demandaId: string;
  clienteId: string;
  clienteNombre: string;
  deudorId: string;
  deudorNombre: string;
  /** Nombres de `demandados[]` de la demanda; puede venir vacío. */
  demandadosNombres: string[];
  /** Tipificación del deudor. Vacía hasta que se conozca (ver `completarTipificaciones`). */
  tipificacion: string;
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
  /** Tipificaciones del DEUDOR dueño de la demanda; vacío o ausente = todas. */
  tipificaciones?: TipificacionDeuda[];
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
    demandadosNombres: (data.demandados ?? [])
      .map((d) => (d.nombre ?? "").trim())
      .filter(Boolean),
    tipificacion: "",
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

/**
 * Quién aparece en la columna de la demanda: los demandados de la propia demanda
 * y, si no tiene ninguno (≈1 de cada 3 demandas), el nombre del deudor como antes.
 */
export function nombresDemandados(r: DemandaReporteRow): string {
  const nombres = r.demandadosNombres ?? [];
  return nombres.length > 0 ? nombres.join(", ") : r.deudorNombre ?? "";
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Clave de un deudor dentro del reporte: `clienteId/deudorId`. */
const claveDeudor = (clienteId: string, deudorId: string) => `${clienteId}/${deudorId}`;

/**
 * Devuelve el mapa `clienteId/deudorId` → tipificación de los deudores cuya
 * tipificación está entre las pedidas, consultando SOLO los clientes ya acotados.
 * No se leen todos los deudores de la cartera: cada consulta trae únicamente los
 * que ya cumplen, así que el filtro deja además la tipificación lista sin costo extra.
 *
 * La tipificación vive en el deudor (`clientes/{c}/deudores/{d}.tipificacion`) y
 * no está denormalizada en la demanda, así que este cruce es la única vía.
 */
async function cargarDeudoresPorTipificacion(
  clienteIds: string[],
  tipificaciones: TipificacionDeuda[]
): Promise<Map<string, string>> {
  // Firestore 'in' admite hasta 30 valores (hoy hay 10 tipificaciones: un solo lote)
  const lotesTips = chunk(tipificaciones, 30);

  const consultas = clienteIds.flatMap((clienteId) =>
    lotesTips.map(async (tips) => {
      const snap = await getDocs(
        query(
          collection(db, `clientes/${clienteId}/deudores`),
          where("tipificacion", "in", tips)
        )
      );
      return { clienteId, snap };
    })
  );

  const resultados = await Promise.all(consultas);

  const porDeudor = new Map<string, string>();
  resultados.forEach(({ clienteId, snap }) => {
    snap.docs.forEach((d) =>
      porDeudor.set(claveDeudor(clienteId, d.id), (d.data().tipificacion as string) ?? "")
    );
  });
  return porDeudor;
}

/**
 * Completa la tipificación de las filas que aún no la traen (caso "Todas"), leyendo
 * por ID SOLO los deudores que aparecen en el resultado, en lotes de 30 por cliente.
 * No recorre la cartera entera. Se llama bajo demanda —hoy, al exportar a Excel—
 * para no pagar estas lecturas en cada búsqueda.
 *
 * Devuelve filas nuevas; las originales no se mutan.
 */
export async function completarTipificaciones(
  rows: DemandaReporteRow[]
): Promise<DemandaReporteRow[]> {
  // Deudores sin tipificación conocida, agrupados por cliente
  const pendientesPorCliente = new Map<string, Set<string>>();
  rows.forEach((r) => {
    if (r.tipificacion || !r.clienteId || !r.deudorId) return;
    const set = pendientesPorCliente.get(r.clienteId) ?? new Set<string>();
    set.add(r.deudorId);
    pendientesPorCliente.set(r.clienteId, set);
  });

  if (pendientesPorCliente.size === 0) return rows;

  const consultas = [...pendientesPorCliente.entries()].flatMap(([clienteId, deudorIds]) =>
    // Firestore 'in' admite hasta 30 valores → un lote por cada 30 deudores
    chunk([...deudorIds], 30).map(async (ids) => {
      const snap = await getDocs(
        query(collection(db, `clientes/${clienteId}/deudores`), where(documentId(), "in", ids))
      );
      return { clienteId, snap };
    })
  );

  const resultados = await Promise.all(consultas);

  const porDeudor = new Map<string, string>();
  resultados.forEach(({ clienteId, snap }) => {
    snap.docs.forEach((d) =>
      porDeudor.set(claveDeudor(clienteId, d.id), (d.data().tipificacion as string) ?? "")
    );
  });

  return rows.map((r) =>
    r.tipificacion
      ? r
      : { ...r, tipificacion: porDeudor.get(claveDeudor(r.clienteId, r.deudorId)) ?? "" }
  );
}

/**
 * Busca demandas acotando la consulta al servidor por `clienteId` (denormalizado
 * en cada demanda) cuando hay cliente o dependiente seleccionado. Así NO se leen
 * todas las demandas de la base. El resto de filtros (etiqueta, fecha, coteje) se
 * aplican en memoria sobre el conjunto ya reducido. La tipificación, que vive en el
 * deudor, se cruza con una consulta acotada por cliente (ver
 * `cargarDeudoresPorTipificacion`) y solo cuando se pide.
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

  let rows = docs.map((d) => docToRow(d, clientes, usuarios));

  // 3) Tipificación del deudor: solo si se pidió, y solo sobre los clientes en juego
  const tips = (filtros.tipificaciones ?? []).filter(Boolean);
  if (tips.length > 0) {
    const clienteIdsEnJuego =
      targetClienteIds ?? [...new Set(rows.map((r) => r.clienteId))].filter(Boolean);
    if (clienteIdsEnJuego.length === 0) return [];
    const permitidos = await cargarDeudoresPorTipificacion(clienteIdsEnJuego, tips);
    rows = rows
      .filter((r) => permitidos.has(claveDeudor(r.clienteId, r.deudorId)))
      .map((r) => ({
        ...r,
        tipificacion: permitidos.get(claveDeudor(r.clienteId, r.deudorId)) ?? "",
      }));
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
