import { useEffect, useState } from "react";
import {
  collection,
  collectionGroup,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/firebase";
import type { Rol } from "@/shared/constants/acl";

export interface ValoresAgregadosBadges {
  /** Círculo rojo: abiertos, míos, y esperando respuesta del área jurídica. */
  primary: number;
  /** Círculo gris: abiertos míos pero en cancha del cliente, o el resto del
   *  sistema si el usuario tiene acceso total. 0 si no aplica. */
  secondary: number;
}

const VACIO: ValoresAgregadosBadges = { primary: 0, secondary: 0 };

/** clienteId → los clientes donde el usuario es abogado o dependiente. */
const carteraCache = new Map<string, Promise<string[]>>();

export function getClienteIdsJuridicaByUsuario(uid: string): Promise<string[]> {
  const cached = carteraCache.get(uid);
  if (cached) return cached;

  // Dos consultas en paralelo en vez de un OR: evita índices compuestos y
  // `clientes` es una colección pequeña.
  const p = Promise.all([
    getDocs(query(collection(db, "clientes"), where("abogadoId", "==", uid))),
    getDocs(query(collection(db, "clientes"), where("dependienteAbogadoId", "==", uid))),
  ])
    .then(([comoAbogado, comoDependiente]) => {
      const ids = new Set<string>();
      comoAbogado.docs.forEach((d) => ids.add(d.id));
      comoDependiente.docs.forEach((d) => ids.add(d.id));
      return [...ids];
    })
    .catch((e) => {
      carteraCache.delete(uid); // no dejar cacheado un fallo
      throw e;
    });

  carteraCache.set(uid, p);
  return p;
}

/**
 * Contador para el badge del menú, con el mismo criterio que el de WhatsApp.
 *
 * El rojo cuenta solo lo **accionable**: abierto y esperando al área jurídica.
 * Un trámite abierto pero en cancha del cliente no es deuda de quien mira el
 * menú, así que va en el gris y no infla el número que exige atención.
 *
 * Reglas:
 *  - acceso total + cartera propia → rojo = los suyos accionables, gris = el resto abierto
 *  - acceso total sin cartera      → rojo = todos los accionables, gris = el resto abierto
 *  - abogado / dependiente         → rojo = los suyos accionables, gris = los suyos en cancha del cliente
 */
export function useValoresAgregadosAbiertos(
  uid: string | undefined,
  roles: Rol[]
): ValoresAgregadosBadges {
  const [badges, setBadges] = useState<ValoresAgregadosBadges>(VACIO);

  useEffect(() => {
    if (!uid) {
      setBadges(VACIO);
      return;
    }

    const isFullAccess =
      roles.includes("admin") ||
      roles.includes("supervisor") ||
      roles.includes("ejecutivoAdmin");
    const esJuridica = roles.includes("abogado") || roles.includes("dependiente");

    // Nadie más necesita este contador (el cliente ve su propia lista).
    if (!isFullAccess && !esJuridica) {
      setBadges(VACIO);
      return;
    }

    let cancelled = false;
    let cartera: Set<string> | null = null;
    let abiertos: { clienteId: string | null; esperaJuridica: boolean }[] = [];

    const recompute = () => {
      if (cancelled || !cartera) return;

      const mios = abiertos.filter((v) => v.clienteId && cartera!.has(v.clienteId));
      const accionablesMios = mios.filter((v) => v.esperaJuridica).length;

      if (isFullAccess && cartera.size > 0) {
        setBadges({
          primary: accionablesMios,
          secondary: abiertos.length - accionablesMios,
        });
      } else if (isFullAccess) {
        const accionablesTotal = abiertos.filter((v) => v.esperaJuridica).length;
        setBadges({
          primary: accionablesTotal,
          secondary: abiertos.length - accionablesTotal,
        });
      } else {
        setBadges({
          primary: accionablesMios,
          secondary: mios.length - accionablesMios,
        });
      }
    };

    getClienteIdsJuridicaByUsuario(uid)
      .then((ids) => {
        cartera = new Set(ids);
        recompute();
      })
      .catch(() => {
        cartera = new Set();
        recompute();
      });

    const unsub = onSnapshot(
      query(collectionGroup(db, "valoresAgregados"), where("estado", "==", "abierto")),
      (snap) => {
        abiertos = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            clienteId: (data.clienteId ?? d.ref.parent.parent?.id ?? null) as string | null,
            esperaJuridica: data.esperaRespuestaDe !== "cliente",
          };
        });
        recompute();
      },
      (err) => {
        console.error("[useValoresAgregadosAbiertos] onSnapshot error:", err);
        setBadges(VACIO);
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, roles.join(",")]);

  return badges;
}
