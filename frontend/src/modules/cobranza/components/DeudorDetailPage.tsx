// src/modules/deudores/pages/DeudorDetailPage.tsx
'use client';

import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spinner } from '@/shared/ui/spinner';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Eye, History, ArrowLeft } from 'lucide-react';
import { getDeudorById } from '../services/deudorService';
import type { Deudor } from '../models/deudores.model';

export default function DeudorDetailPage() {
  const { clienteId, deudorId } = useParams<{ clienteId: string; deudorId: string }>();
  const navigate = useNavigate();

  const [deudor, setDeudor] = React.useState<Deudor | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!clienteId || !deudorId) return;

    let canceled = false;
    setLoading(true);

    getDeudorById(clienteId, deudorId)
      .then((d) => { if (!canceled) setDeudor(d); })
      .finally(() => { if (!canceled) setLoading(false); });

    return () => { canceled = true; };
  }, [clienteId, deudorId]);

  if (loading) return <Spinner />;
  if (!deudor) return <div className="p-4">No se encontró el deudor</div>;

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Botón Volver */}
      <Button variant="ghost" size="sm" className="mb-1 w-fit" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-1" />
        Volver
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Información del Deudor</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-3 text-sm text-muted-foreground">
          <div><span className="font-medium text-foreground">Nombre del deudor:</span> {deudor.nombre}</div>
          <div><span className="font-medium text-foreground">Teléfonos:</span> {deudor.telefonos?.join(', ') || 'No registrados'}</div>
          <div><span className="font-medium text-foreground">Correos:</span> {deudor.correos?.join(', ') || 'No registrados'}</div>
          <div><span className="font-medium text-foreground">Tipificación:</span> {deudor.tipificacion}</div>

          {/* Acciones */}
          <div className="pt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/deudores/${clienteId}/${deudor.id}/acuerdo`)}
            >
              <Eye className="w-4 h-4 mr-1" />
              Ver Acuerdo
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate(`/deudores/${clienteId}/${deudor.id}/seguimiento`)}
            >
              <History className="w-4 h-4 mr-1" />
              Seguimiento
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate(`/deudores/${clienteId}/${deudor.id}/estadosMensuales`)}
            >
              <History className="w-4 h-4 mr-1" />
              Abonos
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
