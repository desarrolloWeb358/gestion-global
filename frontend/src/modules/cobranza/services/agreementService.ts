// src/modules/cobranza/services/agreementService.ts
import { doc, collection, writeBatch, getDocs } from "firebase/firestore";
import { db } from "../../../firebase";
import { Cuota, AcuerdoPago } from "../models/acuerdoPago.model";

/**
 * Guarda el acuerdo completo:
 * - metadata en: .../acuerdo_pago/metadata
 * - cuotas en subcolección: .../acuerdo_pago/cuotas/{numero}
 * - borra cuotas anteriores antes de grabar las nuevas
 */
export async function guardarAcuerdoCompleto(
  clienteId: string,
  inmuebleId: string,
  metadata: AcuerdoPago, // metadatos SIN el array de cuotas
  cuotas: Cuota[]
) {
  if (!clienteId || !inmuebleId) {
    throw new Error("clienteId e inmuebleId son obligatorios.");
  }

  // Validaciones rápidas
  const numeros = cuotas.map((c) => c.numero);
  const hayDuplicados = new Set(numeros).size !== numeros.length;
  if (hayDuplicados) {
    throw new Error("Existen cuotas con 'numero' duplicado.");
  }

  const metaRef = doc(
    db,
    "clientes",
    clienteId,
    "inmuebles",
    inmuebleId,
    "acuerdo_pago",
    "metadata"
  );

  const cuotasCol = collection(
    db,
    "clientes",
    clienteId,
    "inmuebles",
    inmuebleId,
    "acuerdo_pago",
    "cuotas"
  );

  const batch = writeBatch(db);

  // Guarda metadata (no incluye array de cuotas)
  batch.set(metaRef, metadata);

  // Borra cuotas anteriores
  const prev = await getDocs(cuotasCol);
  prev.docs.forEach((d) => batch.delete(d.ref));

  // Guarda cuotas nuevas (id = numero de cuota)
  cuotas.forEach((c) => {
    const cRef = doc(cuotasCol, String(c.numero));
    batch.set(cRef, c);
  });

  await batch.commit();
}
