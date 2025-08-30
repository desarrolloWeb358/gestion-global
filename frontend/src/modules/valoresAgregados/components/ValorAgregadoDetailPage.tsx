"use client";

import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { obtenerValorAgregado, timestampToDateInput } from "../services/valorAgregadoService";
import { ValorAgregado } from "../models/valorAgregado.model";
import { TipoValorAgregadoLabels } from "../../../shared/constants/tipoValorAgregado";

export default function ValorAgregadoDetailPage() {
  const { clienteId, valorId } = useParams<{ clienteId: string; valorId: string }>();
  const navigate = useNavigate();

  const [item, setItem] = React.useState<ValorAgregado | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!clienteId || !valorId) return;
    let canceled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await obtenerValorAgregado(clienteId, valorId);
        if (!canceled) setItem(data);
      } finally {
        if (!canceled) setLoading(false);
      }
    })();

    return () => { canceled = true; };
  }, [clienteId, valorId]);

  if (loading) return <Spinner />;
  if (!item) return <div className="p-4">No se encontró el registro</div>;

  return (
    <div className="px-4 py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Detalle del Valor Agregado</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground">
          <div><span className="font-medium text-foreground">Fecha:</span> {timestampToDateInput(item.fecha as any) || "—"}</div>
          <div><span className="font-medium text-foreground">Tipo:</span> {TipoValorAgregadoLabels[item.tipo]}</div>
          <div><span className="font-medium text-foreground">Título:</span> {item.titulo}</div>
          <div><span className="font-medium text-foreground">Observaciones:</span> {item.observaciones || "—"}</div>
          <div>
            <span className="font-medium text-foreground">Archivo:</span>{" "}
            {item.archivoURL ? (
              <a className="text-primary underline" href={item.archivoURL} target="_blank" rel="noreferrer">
                {item.archivoNombre ?? "Ver archivo"}
              </a>
            ) : "—"}
          </div>

          <div className="pt-4">
            <Button variant="outline" onClick={() => navigate(`/valores-agregados/${clienteId}`)}>
              Volver al listado
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
