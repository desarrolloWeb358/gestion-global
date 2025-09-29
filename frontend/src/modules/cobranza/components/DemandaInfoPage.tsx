import * as React from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { db } from "@/firebase";
import { Deudor } from "../models/deudores.model";

export function DemandaInfoPage() {
  const { clienteId, deudorId } = useParams();
  const [deudor, setDeudor] = React.useState<Deudor | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        if (!clienteId || !deudorId) throw new Error("Faltan parámetros");
        const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error("El deudor no existe");
        setDeudor({ id: deudorId, ...(snap.data() as Deudor) });
      } catch (e: any) {
        setError(e.message ?? "Error cargando la demanda");
      } finally {
        setLoading(false);
      }
    })();
  }, [clienteId, deudorId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Información de la demanda</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{error}</p>
          <div className="mt-4">
            <Button asChild variant="secondary">
              <Link to={`/deudores/${clienteId}/${deudorId}`}>Volver al deudor</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const campos = {
    demandados: deudor?.demandados ?? "—",
    juzgado: deudor?.juzgado ?? deudor?.juzgadoId ?? "—",
    numeroRadicado: deudor?.numeroRadicado ?? deudor?.numeroProceso ?? "—",
    localidad: deudor?.localidad ?? "—",
    observacionesDemanda: deudor?.observacionesDemanda ?? "",
    observacionesDemandaCliente: deudor?.observacionesDemandaCliente ?? "",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Información de la demanda</h1>
        <Button asChild variant="secondary">
          <Link to={`/deudores/${clienteId}/${deudorId}`}>Volver</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos principales</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Demandados" value={campos.demandados} />
          <Field label="Juzgado" value={campos.juzgado} />
          <Field label="Número de radicado" value={campos.numeroRadicado} />
          <Field label="Localidad" value={campos.localidad} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Observaciones (internas)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={campos.observacionesDemanda} readOnly className="min-h-36" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Observaciones (para cliente)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={campos.observacionesDemandaCliente} readOnly className="min-h-36" />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase text-muted-foreground">{label}</Label>
      <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">{value || "—"}</div>
    </div>
  );
}
