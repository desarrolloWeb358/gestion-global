// src/modules/deudores/pages/DeudorDetailPage.tsx
'use client';

import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { getDeudorById } from '../services/deudorService';
import { Deudor } from '../models/deudores.model';
import DeudorInfoCard from '../components/DeudorInfoCard';
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
      <DeudorInfoCard deudor={deudor} />

      {/* Sección de Abonos */}
      <Card>
        <CardHeader>
          <CardTitle>Abonos realizados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormAgregarAbono deudor={deudor} onAgregado={recargarDeudor} />

          {Array.isArray(deudor.abonos) && deudor.abonos.length > 0 ? (
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
          ) : (
            <p className="text-muted-foreground text-sm">No hay abonos registrados.</p>
          )}
        </CardContent>
      </Card>

      {/* Sección de Estadística de Abonos */}
      <EstadisticaAbonos deudor={deudor} />

    </div>
  );
}
