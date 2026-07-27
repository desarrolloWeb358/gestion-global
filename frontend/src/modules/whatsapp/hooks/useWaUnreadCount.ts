import { useEffect, useState } from "react";
import { collectionGroup, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/firebase";
import { getClienteIdsByEjecutivo } from "../services/conversationsService";
import type { Rol } from "@/shared/constants/acl";

export interface WaUnreadBadges {
  /** Círculo rojo: lo que le toca atender al usuario. */
  primary: number;
  /** Círculo gris: el resto del sistema. 0 si no aplica. */
  secondary: number;
}

const VACIO: WaUnreadBadges = { primary: 0, secondary: 0 };

/**
 * Reglas:
 *  - acceso total + cartera propia → rojo = las suyas, gris = las demás
 *    (los dos suman el total, no se pisan)
 *  - acceso total sin cartera      → rojo = el total, gris = 0
 *  - ejecutivo                     → rojo = las suyas, gris = 0
 */
export function useWaUnreadCount(uid: string | undefined, roles: Rol[]): WaUnreadBadges {
  const [badges, setBadges] = useState<WaUnreadBadges>(VACIO);

  useEffect(() => {
    if (!uid) {
      setBadges(VACIO);
      return;
    }

    const isFullAccess =
      roles.includes("admin") ||
      roles.includes("supervisor") ||
      roles.includes("ejecutivoAdmin");

    let cancelled = false;
    let cartera: Set<string> | null = null;
    let sinLeer: (string | null)[] = [];

    // Se recalcula cuando llega cualquiera de los dos datos (cartera o snapshot)
    const recompute = () => {
      if (cancelled || !cartera) return;
      const total = sinLeer.length;
      const mias = sinLeer.filter((cId) => cId && cartera!.has(cId)).length;

      if (isFullAccess && cartera.size > 0) setBadges({ primary: mias, secondary: total - mias });
      else if (isFullAccess) setBadges({ primary: total, secondary: 0 });
      else setBadges({ primary: mias, secondary: 0 });
    };

    getClienteIdsByEjecutivo(uid)
      .then((ids) => { cartera = new Set(ids); recompute(); })
      .catch(() => { cartera = new Set(); recompute(); });

    const unsub = onSnapshot(
      query(collectionGroup(db, "conversations"), where("unreadCount", ">", 0)),
      (snap) => {
        sinLeer = snap.docs.map((d) => (d.data().clienteId ?? null) as string | null);
        recompute();
      }
    );

    return () => { cancelled = true; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, roles.join(",")]);

  return badges;
}
