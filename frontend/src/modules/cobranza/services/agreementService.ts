// src/modules/cobranza/services/agreementService.ts
import { doc, collection, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { agreementMetadata, Cuota } from '../models/agreement.model';

export async function guardarAcuerdoCompleto(
  clienteId: string,
  inmuebleId: string,
  metadata: agreementMetadata,
  cuotas: Cuota[]
) {
  const metaRef = doc(
    db,
    'clientes',
    clienteId,
    'inmuebles',
    inmuebleId,
    'acuerdo_pago',
    'metadata'
  );
  const cuotasCol = collection(
    db,
    'clientes',
    clienteId,
    'inmuebles',
    inmuebleId,
    'acuerdo_pago',
    'cuotas'
  );

  const batch = writeBatch(db);
  batch.set(metaRef, metadata);

  // Borra cuotas anteriores (opcional)
  const old = await getDocs(cuotasCol);
  old.docs.forEach(d => batch.delete(d.ref));

  // Graba sólo los campos de Cuota
  cuotas.forEach(c => {
    const cRef = doc(cuotasCol, c.numero_cuota.toString());
    batch.set(cRef, c);
  });

  await batch.commit();
}
