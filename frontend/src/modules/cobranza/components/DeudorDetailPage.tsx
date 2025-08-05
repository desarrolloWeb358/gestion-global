// src/modules/deudores/pages/DeudorDetailPage.tsx
'use client';

import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { getDeudorById } from '../services/deudorService';
import { Deudor } from '../models/deudores.model';
import DeudorInfoCard from './DeudorInfoCard';
// Update the import path if the file exists elsewhere, for example:
import EstadisticaAbonos from '../components/EstadisticaAbonos';
// Or create 'EstadisticaAbonos.tsx' in the current directory if missing.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import FormAgregarAbono from './FormAgregarAbono';

export default function DeudorDetailPage() {
  const { clienteId, deudorId } = useParams();
  const [deudor, setDeudor] = useState<Deudor | null>(null);
  const [loading, setLoading] = useState(true);
  
  

  const recargarDeudor = () => {
    if (clienteId && deudorId) {
      getDeudorById(clienteId, deudorId).then(setDeudor);
    }
  };

  useEffect(() => {
    if (clienteId && deudorId) {
      getDeudorById(clienteId, deudorId)
        .then(setDeudor)
        .finally(() => setLoading(false));
    }
  }, [clienteId, deudorId]);

  if (loading) return <Spinner />;
  if (!deudor) return <div>No se encontró el deudor</div>;

  return (
    <div className="px-4 py-6 space-y-6">
      

      {/* Información del deudor */}
     <DeudorInfoCard deudor={deudor} clienteId={clienteId!} abonos={deudor.abonos} />


      {/* Sección de Estadística de Abonos */}
      <EstadisticaAbonos deudor={deudor} />

    </div>
  );
}
