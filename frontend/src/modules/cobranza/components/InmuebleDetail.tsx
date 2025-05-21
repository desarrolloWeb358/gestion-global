// src/pages/InmuebleDetail.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Inmueble } from '../models/inmueble.model';
import AgreementForm from '../../usuarios/components/AgreementForm';
import AgreementTable from '../../usuarios/components/AgreementTable';

export default function InmuebleDetail() {
  const { clienteId, inmuebleId } = useParams<{ clienteId: string; inmuebleId: string }>();
  const [inmueble, setInmueble] = useState<Inmueble | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const loadInmueble = async () => {
    if (!inmuebleId) return;
    setLoading(true);
    try {
      const ref = doc(db, 'inmuebles', inmuebleId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setInmueble(snap.data() as Inmueble);
      } else {
        setInmueble(null);
      }
    } catch (error) {
      console.error('Error cargando inmueble:', error);
      setInmueble(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInmueble();
  }, [inmuebleId]);

  if (loading) return <p>Cargando inmueble...</p>;
  if (!inmueble) return <p>Inmueble no encontrado.</p>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Acuerdo de Pago - {inmueble.responsable}</h1>

      {/* Formulario para generar o actualizar el acuerdo */}
      <AgreementForm inmuebleId={inmueble.id!} onSuccess={loadInmueble} />

      {/* Tabla de cronograma */}
      {inmueble.acuerdo_pago && (
        <AgreementTable inmueble={inmueble} onDataChange={loadInmueble} />
      )}
    </div>
  );
}
