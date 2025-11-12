// ==============================
// services/recaudoMensualService.ts
// ==============================

import { collectionGroup, getDocs, query, where, QueryConstraint } from "firebase/firestore";
import { db } from "@/firebase";
import {
  EstadoMensualItem,
  ResumenMesSeleccionado,
  ResumenPorCliente,
  TotalesMes,
} from "../models/recaudoMensual.model";
import { listarClientesBasico } from "@/modules/clientes/services/clienteService";


/** Lee TODOS los estadosMensuales del mes indicado ("YYYY-MM") */
export async function obtenerEstadosMensualesPorMes(
  mesYYYYMM: string,
  clienteUID?: string
): Promise<EstadoMensualItem[]> {
    listarEstadosMensualesSinCliente(mesYYYYMM); // debug: listar estados sin clienteUID
  const constraints: QueryConstraint[] = [where("mes", "==", mesYYYYMM)];
  if (clienteUID) constraints.push(where("clienteUID", "==", clienteUID));

  const cg = collectionGroup(db, "estadosMensuales");
  const snap = await getDocs(query(cg, ...constraints));

  const items: EstadoMensualItem[] = [];
  snap.forEach((docSnap) => {
    const d: any = docSnap.data() || {};
    items.push({
      id: docSnap.id,
      clienteUID: d.clienteUID,
      inmuebleUID: d.inmuebleUID,
      mes: d.mes,
      deuda: Number(d.deuda ?? 0),
      honorario: Number(d.honorario ?? 0),
      recaudo: Number(d.recaudo ?? 0),
    });
  });

  return items;
}

/** Resume los items del mes (totales + por cliente, SIN %). */
export function resumirMesSinPorcentaje(
  items: EstadoMensualItem[],
  mesYYYYMM: string
): { totales: TotalesMes; porClienteUID: Omit<ResumenPorCliente, "clienteNombre">[] } {
  let totalDeuda = 0;
  let totalHonorario = 0;
  let totalRecaudo = 0;

  const map = new Map<string, Omit<ResumenPorCliente, "clienteNombre">>();
  for (const it of items) {
    totalDeuda += it.deuda || 0;
    totalHonorario += it.honorario || 0;
    totalRecaudo += it.recaudo || 0;

    const k = it.clienteUID || "SIN_CLIENTE";
    if (!map.has(k)) map.set(k, { clienteUID: k, deuda: 0, honorario: 0, recaudo: 0 });
    const r = map.get(k)!;
    r.deuda += it.deuda || 0;
    r.honorario += it.honorario || 0;
    r.recaudo += it.recaudo || 0;
  }

  return {
    totales: {
      mes: mesYYYYMM,
      totalDeuda,
      totalHonorario,
      totalRecaudo,
    },
    porClienteUID: Array.from(map.values()).sort((a, b) => b.recaudo - a.recaudo),
  };
}

/** Anexa nombres de clientes usando clienteService (UID → nombre). */
export async function anexarNombresClientes(
  resumenUID: { totales: TotalesMes; porClienteUID: Omit<ResumenPorCliente, "clienteNombre">[] }
): Promise<ResumenMesSeleccionado> {
  const basicos = await listarClientesBasico(); // {id, nombre}
  const nombreById = new Map(basicos.map((c) => [c.id, c.nombre]));

  const porCliente: ResumenPorCliente[] = resumenUID.porClienteUID.map((r) => ({
    ...r,
    clienteNombre: nombreById.get(r.clienteUID) || r.clienteUID,
  }));

  return { totales: resumenUID.totales, porCliente };
}

/** Helper principal que usa las dos funciones anteriores. */
export async function obtenerResumenMesConNombres(
  mesYYYYMM: string,
  clienteUID?: string
): Promise<ResumenMesSeleccionado> {
  const items = await obtenerEstadosMensualesPorMes(mesYYYYMM, clienteUID);
  const base = resumirMesSinPorcentaje(items, mesYYYYMM);
  return anexarNombresClientes(base);
}


// Revisa un mes puntual
export async function listarEstadosMensualesSinCliente(mesYYYYMM: string) {
  const qy = query(
    collectionGroup(db, "estadosMensuales"),
    where("mes", "==", mesYYYYMM)
  );
  const snap = await getDocs(qy);

  const malos: Array<{ path: string; data: any }> = [];
  snap.forEach((d) => {
    const data = d.data();
    const uid = data?.clienteUID;
    if (
      uid === undefined || uid === null || 
      (typeof uid === "string" && uid.trim() === "")
    ) {
      malos.push({ path: d.ref.path, data });
    }
  });

  console.log("Estados sin clienteUID:", malos);
  return malos;
}