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
import { getUsuarioByUid } from '@/modules/usuarios/services/usuarioService';
import type { UsuarioSistema } from '@/modules/usuarios/models/usuarioSistema.model';

export default function DeudorDetailPage() {
  const { clienteId, deudorId } = useParams<{ clienteId: string; deudorId: string }>();
  const navigate = useNavigate();

  const [deudor, setDeudor] = React.useState<Deudor | null>(null);
  const [usuario, setUsuario] = React.useState<UsuarioSistema | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingUsuario, setLoadingUsuario] = React.useState(false);

  React.useEffect(() => {
    if (!clienteId || !deudorId) return;

    let canceled = false;
    setLoading(true);

    getDeudorById(clienteId, deudorId)
      .then(async (d) => {
        if (canceled) return;
        setDeudor(d);

        // si el deudor tiene relación con un usuario
        if (d?.uidUsuario) {
          setLoadingUsuario(true);
          try {
            const u = await getUsuarioByUid(String(d.uidUsuario));
            if (!canceled) setUsuario(u);
          } finally {
            if (!canceled) setLoadingUsuario(false);
          }
        }
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });

    return () => {
      canceled = true;
    };
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
          <div>
            <span className="font-medium text-foreground">Nombre del deudor:</span>{' '}
            {deudor.nombre}
          </div>

          <div>
            <span className="font-medium text-foreground">Teléfono:</span>{' '}
            {loadingUsuario ? 'Cargando…' : usuario?.telefonoUsuario || 'No registrado'}
          </div>

          <div>
            <span className="font-medium text-foreground">Correo:</span>{' '}
            {loadingUsuario ? 'Cargando…' : usuario?.email || 'No registrado'}
          </div>

          <div>
            <span className="font-medium text-foreground">Documento:</span>{' '}
            {loadingUsuario
              ? 'Cargando…'
              : usuario
              ? `${usuario.tipoDocumento} ${usuario.numeroDocumento}`
              : 'No registrado'}
          </div>

          <div>
            <span className="font-medium text-foreground">Tipificación:</span>{' '}
            {deudor.tipificacion}
          </div>

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
            <Button
              variant="outline"
              onClick={() => navigate(`/clientes/${clienteId}/deudores/${deudor.id}/demanda`)}
            >
              <History className="w-4 h-4 mr-1" />
              información demanda
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
