// src/modules/cobranza/components/InmuebleDetail.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Inmueble } from '../models/inmueble.model';
import AgreementForm from '../../usuarios/components/AgreementForm';
import AgreementGrid from './AgreementGrid';

export default function InmuebleDetail() {
  const { clienteId, inmuebleId } = useParams<{ clienteId: string; inmuebleId: string }>();
  const [inmueble, setInmueble] = useState<Inmueble | null>(null);
  const [loading, setLoading] = useState(false);

  const loadInmueble = async () => {
    if (!inmuebleId) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'inmuebles', inmuebleId));
      if (snap.exists()) {
        setInmueble({ id: snap.id, ...(snap.data() as Omit<Inmueble, 'id'>) });
      } else {
        setInmueble(null);
      }
    } catch (err) {
      console.error(err);
      setInmueble(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInmueble();
  }, [inmuebleId]);

  if (loading) return <p>Cargando...</p>;
  if (!inmueble) return <p>Inmueble no encontrado.</p>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Acuerdo de Pago - {inmueble.responsable}</h1>
      <AgreementForm inmuebleId={inmueble.id!} onSuccess={loadInmueble} />
      {inmueble.acuerdo_pago && (
        <AgreementGrid inmueble={inmueble} onDataChange={loadInmueble} />
      )}
    </div>
  );
}
