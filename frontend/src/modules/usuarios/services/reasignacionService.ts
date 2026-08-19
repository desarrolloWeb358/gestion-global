// src/modules/usuarios/services/reasignacionService.ts
//
// Reasignación de cartera entre usuarios del equipo (Ajustes → Reasignar usuarios).
//
// Idea clave: la unidad de migración NO es el rol ni el usuario, es la FUNCIÓN
// (= un campo concreto de una colección concreta). Un mismo rol ocupa varios
// campos —`dependiente` llena `ejecutivoDependienteId`, `dependienteAbogadoId` y
// `clientesParticulares.dependienteId`— y un usuario puede tener varios roles.
// Migrar "todo lo de una persona" rompería las funciones que sí conserva.
//
// Solo se mueve la asignación VIVA. Lo histórico (creadoPor, autorUid,
// subidoPor, auditLogs, registrosEliminados) no se toca: debe seguir diciendo
// quién hizo cada cosa.
//
// Todo lo demás se resuelve solo: deudores y sus subcolecciones no guardan el
// UID del gestor, y dashboards, WhatsApp, reportes y Cloud Functions derivan el
// responsable leyendo el cliente en cada consulta.
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type WriteBatch,
} from "firebase/firestore";
import { auth, db } from "@/firebase";
import type { Rol } from "@/shared/constants/acl";
import type { UsuarioSistema } from "../models/usuarioSistema.model";

/* ── Catálogo de funciones asignables ──────────────────────────────────── */

export type FuncionKey =
  | "ejecutivoPrejuridico"
  | "ejecutivoJuridico"
  | "ejecutivoDependiente"
  | "abogado"
  | "dependienteAbogado"
  | "casosAbogado"
  | "casosDependiente";

export interface FuncionAsignable {
  key: FuncionKey;
  label: string;
  detalle: string;
  /** Rol que el usuario entrante DEBE tener para recibir esta función. */
  rol: Rol;
  coleccion: "clientes" | "clientesParticulares";
  campo: string;
}

export const FUNCIONES_ASIGNABLES: readonly FuncionAsignable[] = [
  {
    key: "ejecutivoPrejuridico",
    label: "Ejecutivo prejurídico",
    detalle: "Conjuntos donde lleva la cartera pre-jurídica (también define su bandeja de WhatsApp)",
    rol: "ejecutivo",
    coleccion: "clientes",
    campo: "ejecutivoPrejuridicoId",
  },
  {
    key: "ejecutivoJuridico",
    label: "Ejecutivo jurídico",
    detalle: "Conjuntos donde lleva la cartera jurídica",
    rol: "ejecutivo",
    coleccion: "clientes",
    campo: "ejecutivoJuridicoId",
  },
  {
    key: "ejecutivoDependiente",
    label: "Dependiente (cartera de demandas)",
    detalle: "Conjuntos cuyas demandas gestiona",
    rol: "dependiente",
    coleccion: "clientes",
    campo: "ejecutivoDependienteId",
  },
  {
    key: "abogado",
    label: "Abogado",
    detalle: "Conjuntos donde responde valores agregados y plazos legales",
    rol: "abogado",
    coleccion: "clientes",
    campo: "abogadoId",
  },
  {
    key: "dependienteAbogado",
    label: "Dependiente del abogado",
    detalle: "Conjuntos donde apoya al abogado en valores agregados",
    rol: "dependiente",
    coleccion: "clientes",
    campo: "dependienteAbogadoId",
  },
  {
    key: "casosAbogado",
    label: "Abogado de casos",
    detalle: "Clientes particulares (línea de Casos) a su cargo",
    rol: "abogado",
    coleccion: "clientesParticulares",
    campo: "abogadoId",
  },
  {
    key: "casosDependiente",
    label: "Dependiente de casos",
    detalle: "Clientes particulares (línea de Casos) a su cargo",
    rol: "dependiente",
    coleccion: "clientesParticulares",
    campo: "dependienteId",
  },
] as const;

export const FUNCION_POR_KEY = new Map(FUNCIONES_ASIGNABLES.map((f) => [f.key, f]));

/** Roles que hacen gestión de clientes; alimentan el selector de usuario saliente. */
export const ROLES_GESTION: readonly Rol[] = ["ejecutivo", "ejecutivoAdmin", "dependiente", "abogado"];

/* ── Índice de asignaciones ────────────────────────────────────────────── */

/** Documentos que un usuario tiene asignados, agrupados por función. */
export type AsignacionesPorFuncion = Partial<Record<FuncionKey, string[]>>;

export interface IndiceAsignaciones {
  /** uid → { función → ids de documentos } */
  porUsuario: Map<string, AsignacionesPorFuncion>;
  /** uid → ids de tareas pendientes o en curso */
  tareasPorUsuario: Map<string, string[]>;
  /** Nombre legible de cada conjunto / cliente particular, para el resumen */
  nombres: Map<string, string>;
}

function pushAsignacion(
  indice: IndiceAsignaciones,
  uid: string,
  funcion: FuncionKey,
  docId: string
) {
  let porFuncion = indice.porUsuario.get(uid);
  if (!porFuncion) {
    porFuncion = {};
    indice.porUsuario.set(uid, porFuncion);
  }
  (porFuncion[funcion] ??= []).push(docId);
}

/**
 * Recorre `clientes`, `clientesParticulares` y `tareas` una sola vez y arma el
 * índice completo uid → asignaciones. Las tres colecciones son pequeñas frente
 * a `deudores`, así que se leen enteras: evita una consulta por cada usuario y
 * permite mostrar los conteos ya en el selector.
 */
export async function cargarIndiceAsignaciones(): Promise<IndiceAsignaciones> {
  const indice: IndiceAsignaciones = {
    porUsuario: new Map(),
    tareasPorUsuario: new Map(),
    nombres: new Map(),
  };

  const [clientesSnap, particularesSnap, tareasSnap] = await Promise.all([
    getDocs(collection(db, "clientes")),
    getDocs(collection(db, "clientesParticulares")),
    getDocs(collection(db, "tareas")),
  ]);

  const snapPorColeccion = {
    clientes: clientesSnap,
    clientesParticulares: particularesSnap,
  } as const;

  for (const [coleccion, snap] of Object.entries(snapPorColeccion)) {
    const funciones = FUNCIONES_ASIGNABLES.filter((f) => f.coleccion === coleccion);
    for (const d of snap.docs) {
      const data = d.data() as Record<string, unknown>;
      indice.nombres.set(d.id, String(data.nombre ?? "").trim() || d.id);
      for (const funcion of funciones) {
        const valor = data[funcion.campo];
        if (typeof valor === "string" && valor.trim()) {
          pushAsignacion(indice, valor.trim(), funcion.key, d.id);
        }
      }
    }
  }

  // Solo tareas vivas: las finalizadas son historial del saliente.
  for (const d of tareasSnap.docs) {
    const data = d.data() as Record<string, unknown>;
    if (data.estado === "finalizada") continue;
    const uid = typeof data.asignadoA === "string" ? data.asignadoA.trim() : "";
    if (!uid) continue;
    const actuales = indice.tareasPorUsuario.get(uid) ?? [];
    actuales.push(d.id);
    indice.tareasPorUsuario.set(uid, actuales);
  }

  return indice;
}

/** Total de asignaciones vivas de un usuario (funciones + tareas). */
export function totalAsignaciones(indice: IndiceAsignaciones, uid: string): number {
  const porFuncion = indice.porUsuario.get(uid) ?? {};
  const deFunciones = Object.values(porFuncion).reduce((acc, ids) => acc + (ids?.length ?? 0), 0);
  return deFunciones + (indice.tareasPorUsuario.get(uid)?.length ?? 0);
}

/**
 * Alertas de la campanita que el saliente dejó sin atender.
 * Se consulta aparte porque vive en una subcolección por usuario.
 */
export async function obtenerNotificacionesSinVer(
  uid: string
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const snap = await getDocs(
    query(collection(db, `usuarios/${uid}/notificaciones`), where("visto", "==", false))
  );
  return snap.docs
    .map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
    .filter((n) => n.data.resuelta !== true);
}

/* ── Validación del usuario entrante ───────────────────────────────────── */

/** Roles que el entrante debe tener para recibir las funciones marcadas. */
export function rolesRequeridos(funciones: FuncionKey[]): Rol[] {
  const roles = new Set<Rol>();
  for (const key of funciones) {
    const funcion = FUNCION_POR_KEY.get(key);
    if (funcion) roles.add(funcion.rol);
  }
  return [...roles];
}

/**
 * Candidatos válidos como usuario entrante: activos, distintos del saliente y
 * con TODOS los roles que exigen las funciones marcadas.
 */
export function candidatosDestino(
  usuarios: UsuarioSistema[],
  origenUid: string,
  funciones: FuncionKey[]
): UsuarioSistema[] {
  const requeridos = rolesRequeridos(funciones);
  return usuarios.filter((u) => {
    if (u.uid === origenUid) return false;
    if (u.activo === false) return false;
    const roles = u.roles ?? [];
    return requeridos.every((r) => roles.includes(r));
  });
}

/* ── Ejecución ─────────────────────────────────────────────────────────── */

export interface PlanReasignacion {
  origen: UsuarioSistema;
  destino: UsuarioSistema;
  funciones: FuncionKey[];
  incluirTareas: boolean;
  incluirNotificaciones: boolean;
}

export interface ResultadoReasignacion {
  porFuncion: Partial<Record<FuncionKey, number>>;
  tareas: number;
  notificaciones: number;
  total: number;
}

const OPS_POR_LOTE = 400; // Firestore admite 500; deja margen.

async function ejecutarEnLotes(ops: Array<(batch: WriteBatch) => void>): Promise<void> {
  for (let i = 0; i < ops.length; i += OPS_POR_LOTE) {
    const batch = writeBatch(db);
    for (const aplicar of ops.slice(i, i + OPS_POR_LOTE)) aplicar(batch);
    await batch.commit();
  }
}

/**
 * Aplica la reasignación. Las escrituras van en lotes; si un lote falla, los
 * anteriores ya quedaron aplicados, así que la operación es reintentable:
 * volver a correrla sobre el mismo saliente solo mueve lo que aún quede.
 */
export async function ejecutarReasignacion(
  plan: PlanReasignacion,
  indice: IndiceAsignaciones
): Promise<ResultadoReasignacion> {
  const { origen, destino } = plan;
  const resultado: ResultadoReasignacion = { porFuncion: {}, tareas: 0, notificaciones: 0, total: 0 };
  const ops: Array<(batch: WriteBatch) => void> = [];

  // 1) Funciones: un campo por documento.
  const porFuncion = indice.porUsuario.get(origen.uid) ?? {};
  for (const key of plan.funciones) {
    const funcion = FUNCION_POR_KEY.get(key);
    const ids = porFuncion[key] ?? [];
    if (!funcion || ids.length === 0) continue;
    resultado.porFuncion[key] = ids.length;
    for (const id of ids) {
      const ref = doc(db, funcion.coleccion, id);
      ops.push((batch) => batch.update(ref, { [funcion.campo]: destino.uid }));
    }
  }

  // 2) Tareas vivas: hay que mover también el nombre denormalizado, si no el
  //    tablero seguiría mostrando al saliente.
  if (plan.incluirTareas) {
    const ids = indice.tareasPorUsuario.get(origen.uid) ?? [];
    resultado.tareas = ids.length;
    const asignadoNombre = destino.nombre ?? destino.email ?? "";
    for (const id of ids) {
      const ref = doc(db, "tareas", id);
      ops.push((batch) =>
        batch.update(ref, {
          asignadoA: destino.uid,
          asignadoNombre,
          fechaActualizacion: serverTimestamp(),
        })
      );
    }
  }

  // 3) Alertas sin ver: se COPIAN al buzón del entrante para que nada quede sin
  //    atender. Las del saliente se conservan como su historial.
  if (plan.incluirNotificaciones) {
    const pendientes = await obtenerNotificacionesSinVer(origen.uid);
    resultado.notificaciones = pendientes.length;
    for (const n of pendientes) {
      const ref = doc(collection(db, `usuarios/${destino.uid}/notificaciones`));
      ops.push((batch) =>
        batch.set(ref, {
          ...n.data,
          visto: false,
          reasignadaDe: origen.uid,
          reasignadaEl: serverTimestamp(),
        })
      );
    }
  }

  await ejecutarEnLotes(ops);

  resultado.total =
    Object.values(resultado.porFuncion).reduce((acc, n) => acc + (n ?? 0), 0) +
    resultado.tareas +
    resultado.notificaciones;

  await registrarReasignacion(plan, resultado);
  return resultado;
}

/** Deja rastro de la reasignación. Nunca bloquea la operación principal. */
async function registrarReasignacion(
  plan: PlanReasignacion,
  resultado: ResultadoReasignacion
): Promise<void> {
  try {
    await addDoc(collection(db, "auditLogs"), {
      accion: "reasignacionUsuario",
      uid: auth.currentUser?.uid ?? "desconocido",
      origenUid: plan.origen.uid,
      origenNombre: plan.origen.nombre ?? plan.origen.email ?? "",
      destinoUid: plan.destino.uid,
      destinoNombre: plan.destino.nombre ?? plan.destino.email ?? "",
      funciones: plan.funciones,
      detalle: resultado.porFuncion,
      tareas: resultado.tareas,
      notificaciones: resultado.notificaciones,
      total: resultado.total,
      fecha: serverTimestamp(),
    });
  } catch {
    console.warn("[reasignacion] No se pudo registrar la auditoría.");
  }
}
