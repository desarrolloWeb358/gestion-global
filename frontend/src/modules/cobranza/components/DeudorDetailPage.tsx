// src/modules/deudores/pages/DeudorDetailPage.tsx
'use client';

import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { getDeudorById } from '../services/deudorService';
import { Deudor } from '../models/deudores.model';
import DeudorInfoCard from '../components/DeudorInfoCard';
import EstadisticaRecaudo from '../components/EstadisticaRecaudo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import FormAgregarAbono from './FormAgregarAbono';

export default function DeudorDetailPage() {
  const { clienteId, deudorId } = useParams();
  const navigate = useNavigate();
  const [deudor, setDeudor] = useState<Deudor | null>(null);
  const [loading, setLoading] = useState(true);
  const recargarDeudor = () => {
  if (clienteId && deudorId) {
    getDeudorById(clienteId, deudorId).then(setDeudor)
  }
}

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
<>
  <DeudorInfoCard deudor={deudor} />

  {/* ABONOS */}
  <Card className="mt-6">
    <CardHeader>
      <CardTitle>Abonos realizados</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <FormAgregarAbono deudor={deudor} />

      {Array.isArray(deudor.abonos) && deudor.abonos.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr><th>Fecha</th><th>Monto</th><th>Tipo</th><th>Recibo</th></tr>
          </thead>
          <tbody>
            {deudor.abonos.map((abono, i) => (
              <tr key={i}>
                <td>{new Date(abono.fecha).toLocaleDateString()}</td>
                <td>${abono.monto.toLocaleString()}</td>
                <td>{abono.tipo}</td>
                <td>{abono.recibo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </CardContent>
  </Card>
</>
    </div>

  );

}
