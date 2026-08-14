// modules/casos/services/casoReporteGlobalService.ts
//
// Reporte global de casos. Mismo enfoque que demandaReporteGlobalService:
// se carga el mapa de clientes (colección pequeña) para resolver responsables
// y franquicia, y se acota la consulta al servidor por `clienteParticularId`
// cuando hay cliente o responsable seleccionado.
import { db } from "@/firebase";
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { toDateSafe } from "@/modules/cobranza/models/demanda.model";
import { franquiciasVisibles, type Rol } from "@/shared/constants/acl";
import type { Caso } from "../models/caso.model";

export interface CasoReporteRow {
  casoId: string;
  clienteParticularId: string;
  clienteNombre: string;
  tipoPersona: string;
  titulo: string;
  tipoCaso: string;
  rolCliente: string;
  numeroRadicado: string;
  juzgado: string;
  localidad: string;
  estado: Caso["estado"];
  abogadoId: string | null;
  abogadoNombre: string;
  dependienteId: string | null;
  dependienteNombre: string;
  franquiciaId: string | null;
  etiquetas: { nombre: string; detalle: string; fecha: Date | null }[];
  proximaAccionFecha: Date | null;
  fechaUltimaRevision: Date | null;
  fechaCreacion: Date | null;
  totalDocumentos: number;
}

export interface CasoReporteFiltros {
  clienteParticularId?: string;
  abogadoId?: string;
  dependienteId?: string;
  estado?: Caso["estado"];
  tipoCaso?: string;
  etiquetaNombre?: string;
  campoFecha?: "fechaUltimaRevision" | "fechaCreacion" | "proximaAccionFecha";
  desde?: Date;
  hasta?: Date;
  // Alcance del usuario que consulta
  roles?: Rol[];
  franquiciasAsignadas?: string[];
}

type ClienteInfo = {
  nombre: string;
  tipoPersona: string;
  abogadoId: string | null;
  dependienteId: string | null;
  franquiciaId: string | null;
};
type ClientesMap = Map<string, ClienteInfo>;
type UsuariosMap = Map<string, string>;

async function cargarMapas(): Promise<{ clientes: ClientesMap; usuarios: UsuariosMap }> {
  const [clientesSnap, usuariosSnap] = await Promise.all([
    getDocs(collection(db, "clientesParticulares")),
    getDocs(collection(db, "usuarios")),
  ]);

  const clientes: ClientesMap = new Map();
  clientesSnap.docs.forEach((d) => {
    const data = d.data() as any;
    clientes.set(d.id, {
      nombre: data.nombre ?? d.id,
      tipoPersona: data.tipoPersona ?? "natural",
      abogadoId: data.abogadoId ?? null,
      dependienteId: data.dependienteId ?? null,
      franquiciaId: data.franquiciaId ?? null,
    });
  });

  const usuarios: UsuariosMap = new Map();
  usuariosSnap.docs.forEach((d) => {
    const data = d.data() as any;
    usuarios.set(d.id, data.nombre ?? data.email ?? d.id);
  });

  return { clientes, usuarios };
}

/** Opciones de los filtros sin leer casos (colecciones pequeñas). */
export async function cargarOpcionesFiltroCasos(): Promise<{
  clientes: { id: string; nombre: string }[];
  abogados: { id: string; nombre: string }[];
  dependientes: { id: string; nombre: string }[];
}> {
  const { clientes, usuarios } = await cargarMapas();

  const clientesArr = [...clientes.entries()]
    .map(([id, v]) => ({ id, nombre: v.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const abogadoIds = new Set<string>();
  const dependienteIds = new Set<string>();
  clientes.forEach((v) => {
    if (v.abogadoId) abogadoIds.add(v.abogadoId);
    if (v.dependienteId) dependienteIds.add(v.dependienteId);
  });

  const aUsuario = (id: string) => ({ id, nombre: usuarios.get(id) ?? id });
  const porNombre = (a: { nombre: string }, b: { nombre: string }) =>
    a.nombre.localeCompare(b.nombre, "es");

  return {
    clientes: clientesArr,
    abogados: [...abogadoIds].map(aUsuario).sort(porNombre),
    dependientes: [...dependienteIds].map(aUsuario).sort(porNombre),
  };
}

function docToRow(
  docSnap: QueryDocumentSnapshot,
  clientes: ClientesMap,
  usuarios: UsuariosMap
): CasoReporteRow {
  const data = docSnap.data() as Caso;
  const clienteParticularId =
    (data.clienteParticularId as string) || docSnap.ref.parent.parent?.id || "";
  const cli = clientes.get(clienteParticularId);

  return {
    casoId: docSnap.id,
    clienteParticularId,
    clienteNombre: cli?.nombre ?? data.clienteNombre ?? clienteParticularId,
    tipoPersona: cli?.tipoPersona ?? "natural",
    titulo: data.titulo ?? "",
    tipoCaso: data.tipoCaso ?? "",
    rolCliente: data.rolCliente ?? "",
    numeroRadicado: data.numeroRadicado ?? "",
    juzgado: data.juzgado ?? "",
    localidad: data.localidad ?? "",
    estado: data.estado ?? "activo",
    abogadoId: cli?.abogadoId ?? null,
    abogadoNombre: cli?.abogadoId ? usuarios.get(cli.abogadoId) ?? cli.abogadoId : "",
    dependienteId: cli?.dependienteId ?? null,
    dependienteNombre: cli?.dependienteId
      ? usuarios.get(cli.dependienteId) ?? cli.dependienteId
      : "",
    franquiciaId: cli?.franquiciaId ?? null,
    etiquetas: (data.etiquetas ?? []).map((e) => ({
      nombre: e.nombre,
      detalle: e.detalle,
      fecha: toDateSafe(e.fecha),
    })),
    proximaAccionFecha: toDateSafe(data.proximaAccionFecha),
    fechaUltimaRevision: toDateSafe(data.fechaUltimaRevision),
    fechaCreacion: toDateSafe(data.fechaCreacion),
    totalDocumentos: (data.documentos ?? []).length,
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function buscarCasos(
  filtros: CasoReporteFiltros = {}
): Promise<CasoReporteRow[]> {
  const { clientes, usuarios } = await cargarMapas();

  // 1) Acotar por cliente / responsable
  let targetIds: string[] | null = null;
  if (filtros.clienteParticularId) {
    targetIds = [filtros.clienteParticularId];
  } else if (filtros.abogadoId || filtros.dependienteId) {
    targetIds = [...clientes.entries()]
      .filter(
        ([, v]) =>
          (filtros.abogadoId ? v.abogadoId === filtros.abogadoId : true) &&
          (filtros.dependienteId ? v.dependienteId === filtros.dependienteId : true)
      )
      .map(([id]) => id);
    if (targetIds.length === 0) return [];
  }

  // 2) Consultas acotadas
  let docs: QueryDocumentSnapshot[] = [];
  if (targetIds) {
    const lotes = chunk(targetIds, 30);
    const snaps = await Promise.all(
      lotes.map((ids) =>
        getDocs(
          query(collectionGroup(db, "casos"), where("clienteParticularId", "in", ids))
        )
      )
    );
    docs = snaps.flatMap((s) => s.docs);
  } else if (filtros.estado) {
    const snap = await getDocs(
      query(collectionGroup(db, "casos"), where("estado", "==", filtros.estado))
    );
    docs = snap.docs;
  } else {
    const snap = await getDocs(collectionGroup(db, "casos"));
    docs = snap.docs;
  }

  return aplicarFiltros(
    docs.map((d) => docToRow(d, clientes, usuarios)),
    filtros
  );
}

function aplicarFiltros(
  rows: CasoReporteRow[],
  f: CasoReporteFiltros
): CasoReporteRow[] {
  const desde = f.desde
    ? new Date(new Date(f.desde).setHours(0, 0, 0, 0)).getTime()
    : undefined;
  const hasta = f.hasta
    ? new Date(new Date(f.hasta).setHours(23, 59, 59, 999)).getTime()
    : undefined;
  const campo = f.campoFecha ?? "fechaUltimaRevision";

  const alcance = franquiciasVisibles({
    roles: f.roles ?? [],
    franquiciasAsignadas: f.franquiciasAsignadas,
  });
  const permitidas = alcance === "ALL" ? null : new Set(alcance);

  return rows
    .filter((r) =>
      permitidas ? !!r.franquiciaId && permitidas.has(r.franquiciaId) : true
    )
    .filter((r) =>
      f.clienteParticularId ? r.clienteParticularId === f.clienteParticularId : true
    )
    .filter((r) => (f.abogadoId ? r.abogadoId === f.abogadoId : true))
    .filter((r) => (f.dependienteId ? r.dependienteId === f.dependienteId : true))
    .filter((r) => (f.estado ? r.estado === f.estado : true))
    .filter((r) => (f.tipoCaso ? r.tipoCaso === f.tipoCaso : true))
    .filter((r) =>
      f.etiquetaNombre ? r.etiquetas.some((e) => e.nombre === f.etiquetaNombre) : true
    )
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
      const av = a.proximaAccionFecha?.getTime() ?? Infinity;
      const bv = b.proximaAccionFecha?.getTime() ?? Infinity;
      return av - bv;
    });
}
