import { db } from "@/firebase";
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  TipoValorAgregado,
  TipoValorAgregadoLabels,
} from "@/shared/constants/tipoValorAgregado";
import type {
  EsperaRespuestaDe,
  EstadoValorAgregado,
} from "../models/valorAgregado.model";

/**
 * Consulta global de valores agregados para la pantalla de seguimiento.
 *
 * Acota al servidor por `clienteId` (denormalizado en cada valor agregado) igual
 * que buscarDemandas: resolver "los clientes de este abogado" se hace en memoria
 * contra la colección `clientes`, que es pequeña. NO se denormaliza `abogadoId`
 * en el valor agregado porque se desincronizaría al reasignar el abogado de un
 * cliente.
 */

export interface ValorAgregadoGlobalRow {
  valorId: string;
  clienteId: string;
  clienteNombre: string;
  tipo: TipoValorAgregado;
  tipoLabel: string;
  titulo: string;
  estado: EstadoValorAgregado;
  esperaRespuestaDe: EsperaRespuestaDe;
  requiereRevision: boolean;
  abogadoId: string | null;
  abogadoNombre: string;
  dependienteId: string | null;
  dependienteNombre: string;
  fechaSolicitud: Date | null;
  fechaLimite: Date | null;
  fechaResolucion: Date | null;
  fechaUltimaActualizacion: Date | null;
  /** Días desde la radicación. Para ordenar por antigüedad real. */
  diasAbierto: number | null;
  /** Días de retraso sobre el plazo legal. Negativo = aún queda tiempo. */
  diasVencido: number | null;
}

export interface ValorAgregadoGlobalFiltros {
  clienteId?: string;
  abogadoId?: string;
  dependienteId?: string;
  estado?: EstadoValorAgregado;
  esperaRespuestaDe?: EsperaRespuestaDe;
  tipo?: TipoValorAgregado;
  soloVencidos?: boolean;
  soloRequierenRevision?: boolean;
  desde?: Date;
  hasta?: Date;
  campoFecha?: "fechaSolicitud" | "fechaLimite" | "fechaResolucion";
}

type ClienteInfo = {
  nombre: string;
  abogadoId: string | null;
  dependienteId: string | null;
};
type ClientesMap = Map<string, ClienteInfo>;
type UsuariosMap = Map<string, string>;

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === "function") return v.toDate();
  if (typeof v.seconds === "number") return new Date(v.seconds * 1000);
  return null;
}

function diasEntre(desde: Date | null, hasta: Date): number | null {
  if (!desde) return null;
  return Math.floor((hasta.getTime() - desde.getTime()) / 86400000);
}

async function cargarMapas(): Promise<{ clientes: ClientesMap; usuarios: UsuariosMap }> {
  const [clientesSnap, usuariosSnap] = await Promise.all([
    getDocs(collection(db, "clientes")),
    getDocs(collection(db, "usuarios")),
  ]);

  const clientes: ClientesMap = new Map();
  clientesSnap.docs.forEach((d) => {
    const data = d.data() as any;
    clientes.set(d.id, {
      nombre: (data.nombre as string) ?? d.id,
      abogadoId: (data.abogadoId as string) ?? null,
      dependienteId: (data.dependienteAbogadoId as string) ?? null,
    });
  });

  const usuarios: UsuariosMap = new Map();
  usuariosSnap.docs.forEach((d) => {
    const data = d.data() as any;
    usuarios.set(d.id, (data.nombre as string) ?? (data.email as string) ?? d.id);
  });

  return { clientes, usuarios };
}

/** Opciones para poblar los filtros sin leer un solo valor agregado. */
export async function cargarOpcionesFiltroValoresAgregados(): Promise<{
  clientes: { id: string; nombre: string }[];
  abogados: { id: string; nombre: string }[];
  dependientes: { id: string; nombre: string }[];
}> {
  const { clientes, usuarios } = await cargarMapas();

  const ordenar = (arr: { id: string; nombre: string }[]) =>
    arr.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const abogadoIds = new Set<string>();
  const dependienteIds = new Set<string>();
  clientes.forEach((c) => {
    if (c.abogadoId) abogadoIds.add(c.abogadoId);
    if (c.dependienteId) dependienteIds.add(c.dependienteId);
  });

  return {
    clientes: ordenar(
      [...clientes.entries()].map(([id, v]) => ({ id, nombre: v.nombre }))
    ),
    abogados: ordenar(
      [...abogadoIds].map((id) => ({ id, nombre: usuarios.get(id) ?? id }))
    ),
    dependientes: ordenar(
      [...dependienteIds].map((id) => ({ id, nombre: usuarios.get(id) ?? id }))
    ),
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function docToRow(
  docSnap: QueryDocumentSnapshot,
  clientes: ClientesMap,
  usuarios: UsuariosMap,
  hoy: Date
): ValorAgregadoGlobalRow {
  const data = docSnap.data() as any;
  const clienteId: string =
    data.clienteId ?? docSnap.ref.parent.parent?.id ?? "";
  const cli = clientes.get(clienteId);

  const tipo = (data.tipo as TipoValorAgregado) ?? TipoValorAgregado.DERECHO_DE_PETICION;
  const fechaSolicitud = toDate(data.fecha);
  const fechaLimite = toDate(data.fechaLimite);
  const fechaResolucion = toDate(data.fechaResolucion) ?? toDate(data.fechaCompletado);

  // Fallback para documentos que aún no pasaron por la migración.
  const estado: EstadoValorAgregado =
    data.estado === "abierto" || data.estado === "resuelto"
      ? data.estado
      : data.completado === true
      ? "resuelto"
      : "abierto";

  return {
    valorId: docSnap.id,
    clienteId,
    clienteNombre: cli?.nombre ?? clienteId,
    tipo,
    tipoLabel: TipoValorAgregadoLabels[tipo] ?? String(tipo),
    titulo: data.titulo ?? "",
    estado,
    esperaRespuestaDe: data.esperaRespuestaDe === "cliente" ? "cliente" : "juridica",
    requiereRevision: data.estadoMigradoRevisar === true,
    abogadoId: cli?.abogadoId ?? null,
    abogadoNombre: cli?.abogadoId ? usuarios.get(cli.abogadoId) ?? cli.abogadoId : "",
    dependienteId: cli?.dependienteId ?? null,
    dependienteNombre: cli?.dependienteId
      ? usuarios.get(cli.dependienteId) ?? cli.dependienteId
      : "",
    fechaSolicitud,
    fechaLimite,
    fechaResolucion,
    fechaUltimaActualizacion: toDate(data.fechaUltimaActualizacion),
    diasAbierto: diasEntre(fechaSolicitud, hoy),
    // Solo tiene sentido para lo que sigue sin resolverse.
    diasVencido:
      fechaLimite && !fechaResolucion ? diasEntre(fechaLimite, hoy) : null,
  };
}

export async function buscarValoresAgregados(
  filtros: ValorAgregadoGlobalFiltros = {}
): Promise<ValorAgregadoGlobalRow[]> {
  const { clientes, usuarios } = await cargarMapas();
  const hoy = new Date();

  // 1) Qué clientes hay que mirar
  let targetClienteIds: string[] | null = null;
  if (filtros.clienteId) {
    targetClienteIds = [filtros.clienteId];
  } else if (filtros.abogadoId || filtros.dependienteId) {
    targetClienteIds = [...clientes.entries()]
      .filter(([, v]) => {
        if (filtros.abogadoId && v.abogadoId !== filtros.abogadoId) return false;
        if (filtros.dependienteId && v.dependienteId !== filtros.dependienteId)
          return false;
        return true;
      })
      .map(([id]) => id);
    if (targetClienteIds.length === 0) return [];
  }

  // 2) Consultas acotadas
  let docs: QueryDocumentSnapshot[] = [];
  if (targetClienteIds) {
    // Firestore 'in' admite hasta 30 valores → dividir en lotes
    const lotes = chunk(targetClienteIds, 30);
    const snaps = await Promise.all(
      lotes.map((ids) =>
        getDocs(
          query(collectionGroup(db, "valoresAgregados"), where("clienteId", "in", ids))
        )
      )
    );
    docs = snaps.flatMap((s) => s.docs);
  } else if (filtros.estado) {
    const snap = await getDocs(
      query(collectionGroup(db, "valoresAgregados"), where("estado", "==", filtros.estado))
    );
    docs = snap.docs;
  } else {
    const snap = await getDocs(collectionGroup(db, "valoresAgregados"));
    docs = snap.docs;
  }

  const rows = docs.map((d) => docToRow(d, clientes, usuarios, hoy));
  return aplicarFiltros(rows, filtros);
}

function aplicarFiltros(
  rows: ValorAgregadoGlobalRow[],
  f: ValorAgregadoGlobalFiltros
): ValorAgregadoGlobalRow[] {
  const desde = f.desde
    ? new Date(new Date(f.desde).setHours(0, 0, 0, 0)).getTime()
    : undefined;
  const hasta = f.hasta
    ? new Date(new Date(f.hasta).setHours(23, 59, 59, 999)).getTime()
    : undefined;
  const campo = f.campoFecha ?? "fechaSolicitud";

  return rows
    .filter((r) => (f.clienteId ? r.clienteId === f.clienteId : true))
    .filter((r) => (f.abogadoId ? r.abogadoId === f.abogadoId : true))
    .filter((r) => (f.dependienteId ? r.dependienteId === f.dependienteId : true))
    .filter((r) => (f.estado ? r.estado === f.estado : true))
    .filter((r) =>
      f.esperaRespuestaDe ? r.esperaRespuestaDe === f.esperaRespuestaDe : true
    )
    .filter((r) => (f.tipo ? r.tipo === f.tipo : true))
    .filter((r) => (f.soloVencidos ? (r.diasVencido ?? -1) > 0 : true))
    .filter((r) => (f.soloRequierenRevision ? r.requiereRevision : true))
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
      // Lo más urgente arriba: primero lo vencido, luego lo más antiguo.
      const av = a.diasVencido ?? -Infinity;
      const bv = b.diasVencido ?? -Infinity;
      if (av !== bv) return bv - av;
      return (b.diasAbierto ?? 0) - (a.diasAbierto ?? 0);
    });
}
