// modules/ajustes/components/EnviosRecordatorioTab.tsx
// Vista de diagnóstico de la automatización de recordatorios de cuota.
//
// TEMPORAL: existe para vigilar el job durante sus primeros días. Lee los
// seguimientos que el propio job escribe (ver enviosRecordatorioCuotasService),
// así que no necesitó instrumentar nada y ve también lo ya enviado.
//
// La carga es MANUAL a propósito — no hay onSnapshot ni recarga automática:
// cada lectura recorre dos collection groups y resuelve nombres de deudor, y
// esta pantalla se deja abierta mientras se trabaja en otra cosa.
import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Mail, Phone, RefreshCw, XCircle } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";
import {
  listarEnviosRecordatorio,
  type EnvioRecordatorio,
  type ResultadoEnvio,
} from "@/modules/cobranza/services/enviosRecordatorioCuotasService";

const ESTILO_RESULTADO: Record<
  ResultadoEnvio,
  { etiqueta: string; clase: string; icono: React.ElementType }
> = {
  enviado: {
    etiqueta: "Enviado",
    clase: "border-green-300 bg-green-50 text-green-800",
    icono: Check,
  },
  sin_dato: {
    etiqueta: "Sin dato",
    clase: "border-amber-300 bg-amber-50 text-amber-800",
    icono: AlertTriangle,
  },
  error: {
    etiqueta: "Falló",
    clase: "border-red-300 bg-red-50 text-red-800",
    icono: XCircle,
  },
  desconocido: {
    etiqueta: "—",
    clase: "border-muted bg-muted text-muted-foreground",
    icono: AlertTriangle,
  },
};

function fechaHora(fecha: Date | null): string {
  if (!fecha) return "—";
  return fecha.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EnviosRecordatorioTab() {
  const [envios, setEnvios] = React.useState<EnvioRecordatorio[] | null>(null);
  const [cargando, setCargando] = React.useState(false);

  const cargar = React.useCallback(async () => {
    try {
      setCargando(true);
      setEnvios(await listarEnviosRecordatorio(100));
    } catch (e: any) {
      // El caso típico es el índice todavía sin desplegar.
      console.error(e);
      toast.error(
        e?.code === "failed-precondition"
          ? "Falta desplegar el índice: firebase deploy --only firestore:indexes"
          : "⚠️ No se pudieron cargar los envíos"
      );
    } finally {
      setCargando(false);
    }
  }, []);

  React.useEffect(() => {
    cargar();
  }, [cargar]);

  const resumen = React.useMemo(() => {
    const base = { correo: 0, whatsapp: 0, sinDato: 0, fallidos: 0 };
    for (const e of envios ?? []) {
      if (e.resultado === "enviado") {
        if (e.canal === "correo") base.correo++;
        else if (e.canal === "whatsapp") base.whatsapp++;
      } else if (e.resultado === "sin_dato") base.sinDato++;
      else if (e.resultado === "error") base.fallidos++;
    }
    return base;
  }, [envios]);

  const ultimo = envios?.[0]?.fecha ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Envíos realizados</h2>
          <p className="text-sm text-muted-foreground">
            Los últimos 100 mensajes que envió la automatización, más recientes primero.
            Son los mismos registros que quedan en el seguimiento de cada deudor.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={cargar}
          disabled={cargando}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={cn("h-4 w-4", cargando && "animate-spin")} />
          {cargando ? "Cargando..." : "Actualizar"}
        </Button>
      </div>

      {envios !== null && envios.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Correos enviados</p>
              <p className="text-2xl font-bold text-brand-primary">{resumen.correo}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">WhatsApp enviados</p>
              <p className="text-2xl font-bold text-brand-primary">{resumen.whatsapp}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Sin dato registrado</p>
              <p className="text-2xl font-bold text-amber-600">{resumen.sinDato}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Fallidos</p>
              <p
                className={cn(
                  "text-2xl font-bold",
                  resumen.fallidos > 0 ? "text-red-600" : "text-muted-foreground"
                )}
              >
                {resumen.fallidos}
              </p>
            </div>
          </div>

          {ultimo && (
            <p className="text-sm text-muted-foreground">
              Último envío registrado: <strong>{fechaHora(ultimo)}</strong>.
            </p>
          )}
        </>
      )}

      {envios !== null && envios.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Todavía no se ha enviado ningún recordatorio.</p>
          <p className="mt-1">
            Es lo esperado si el job aún no ha corrido a las 10:00 a. m., o si ningún
            deudor de los conjuntos marcados tiene una cuota que caiga justo en los plazos
            configurados. Recuerda que solo mira hacia adelante: una cuota ya vencida nunca
            genera aviso.
          </p>
        </div>
      )}

      {envios !== null && envios.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Fecha
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Deudor
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Canal
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Resultado
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Detalle
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {envios.map((e) => {
                  const estilo = ESTILO_RESULTADO[e.resultado];
                  const Icono = estilo.icono;
                  return (
                    <tr key={`${e.clienteId}-${e.deudorId}-${e.id}`} className="align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {fechaHora(e.fecha)}
                      </td>
                      <td className="px-3 py-2">
                        <a
                          href={`/clientes/${e.clienteId}/deudores/${e.deudorId}`}
                          className="font-medium text-brand-primary hover:underline"
                        >
                          {e.deudorNombre}
                        </a>
                        <span className="block text-xs text-muted-foreground">
                          {e.clienteNombre}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          {e.canal === "whatsapp" ? (
                            <Phone className="h-3.5 w-3.5" />
                          ) : (
                            <Mail className="h-3.5 w-3.5" />
                          )}
                          {e.canal === "whatsapp" ? "WhatsApp" : "Correo"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                            estilo.clase
                          )}
                        >
                          <Icono className="h-3 w-3" />
                          {estilo.etiqueta}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {e.descripcion}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
