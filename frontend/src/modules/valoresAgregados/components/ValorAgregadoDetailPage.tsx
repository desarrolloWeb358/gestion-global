"use client";

import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Separator } from "@/shared/ui/separator";
import { Input } from "@/shared/ui/input";
import { toast } from "sonner";
import { Upload, FileText, User as UserIcon } from "lucide-react";

import {
  obtenerValorAgregado,
  timestampToDateInput,
  listarConversacionValorAgregado,
  crearMensajeConversacionValorAgregado,
  formatFechaCO,
} from "../services/valorAgregadoService";

import { ValorAgregado } from "../models/valorAgregado.model";
import { MensajeValorAgregado } from "../models/mensajeValorAgregado.model";
import { TipoValorAgregadoLabels } from "../../../shared/constants/tipoValorAgregado";

import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import { getAuth } from "firebase/auth";
import { cn } from "@/shared/lib/cn";

const MAX_FILE_MB = 15;

function formatMsgDate(input: any): string {
  try {
    if (input && typeof input.toDate === "function")
      return input.toDate().toLocaleString("es-CO", { hour12: false });
    if (input && typeof input.seconds === "number")
      return new Date(input.seconds * 1000).toLocaleString("es-CO", { hour12: false });
    if (input instanceof Date)
      return input.toLocaleString("es-CO", { hour12: false });
  } catch { }
  return "—";
}

export default function ValorAgregadoDetailPage() {
  const { clienteId, valorId } = useParams<{ clienteId: string; valorId: string }>();
  const navigate = useNavigate();

  const { can, roles = [] } = useAcl();
  const canView = can(PERMS.Valores_agregados_Read);
  const canModerate = can((PERMS as any).Valores_Obs_Manage ?? ("valores.obs.manage" as any));
  const isCliente = Array.isArray(roles) && roles.includes("cliente");


  // ===== Detalle principal
  const [item, setItem] = React.useState<ValorAgregado | null>(null);
  const [loading, setLoading] = React.useState(true);

  // ===== Conversación
  const [mensajes, setMensajes] = React.useState<MensajeValorAgregado[]>([]);
  const [msgsLoading, setMsgsLoading] = React.useState(false);
  const [msgSaving, setMsgSaving] = React.useState(false);

  // Nuevo mensaje
  const [texto, setTexto] = React.useState("");
  const [archivoFile, setArchivoFile] = React.useState<File | undefined>(undefined);


  // ===== Cargar detalle
  React.useEffect(() => {
    if (!clienteId || !valorId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await obtenerValorAgregado(clienteId, valorId);
        if (!cancelled) setItem(data);
      } catch (e) {
        console.error(e);
        toast.error("No se pudo cargar el detalle.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clienteId, valorId]);

  // ===== Cargar conversación
  const fetchMensajes = React.useCallback(async () => {
    if (!clienteId || !valorId) return;
    setMsgsLoading(true);
    try {
      const data = await listarConversacionValorAgregado(clienteId, valorId);
      setMensajes(data);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar la conversación.");
    } finally {
      setMsgsLoading(false);
    }
  }, [clienteId, valorId]);

  React.useEffect(() => {
    fetchMensajes();
  }, [fetchMensajes]);

  async function onCrearMensaje() {
    if (!clienteId || !valorId) return;
    

    const desc = texto.trim();
    if (!desc && !archivoFile) {
      toast.error("Escribe una descripción o adjunta un archivo.");
      return;
    }

    const autorTipo: "cliente" | "abogado" = isCliente ? "cliente" : "abogado";

    setMsgSaving(true);
    try {
      await crearMensajeConversacionValorAgregado(
        clienteId,
        valorId,
        {
          descripcion: desc,
          autorTipo,
        },
        archivoFile
      );

      setTexto("");
      setArchivoFile(undefined);
      await fetchMensajes();
      toast.success("Mensaje agregado a la conversación.");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar el mensaje.");
    } finally {
      setMsgSaving(false);
    }
  }

  // ===== Guards
  if (loading) return <Spinner />;

  if (!item || !canView) {
    return (
      <div className="p-4 space-y-4">
        {!canView ? (
          <div className="text-sm">No tienes acceso a Valores agregados.</div>
        ) : (
          <div className="text-sm">No se encontró el registro.</div>
        )}
        <Button variant="ghost" onClick={() => navigate(-1)}>
          ← Volver
        </Button>
      </div>
    );
  }

  // ===== Render
  return (
    <div className="px-4 py-6 space-y-6">
      {/* Detalle del valor agregado (solicitud inicial) */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle del Valor Agregado</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">Fecha de solicitud:</span>{" "}
            {timestampToDateInput(item.fecha as any) || "—"}
          </div>
          <div>
            <span className="font-medium text-foreground">Tipo:</span>{" "}
            {TipoValorAgregadoLabels[item.tipo]}
          </div>
          <div>
            <span className="font-medium text-foreground">Título:</span> {item.titulo}
          </div>
          <div>
            <span className="font-medium text-foreground">Detalle:</span>{" "}
            {item.descripcion || "—"}
          </div>
          <div>
            <span className="font-medium text-foreground">Archivo de la solicitud:</span>{" "}
            {item.archivoURL ? (
              <a
                className="text-primary underline"
                href={item.archivoURL}
                target="_blank"
                rel="noreferrer"
              >
                {item.archivoNombre ?? "Ver archivo"}
              </a>
            ) : (
              "—"
            )}
          </div>
          <div className="pt-4">
            <Button
              variant="outline"
              onClick={() => navigate(`/clientes/${clienteId}/valores-agregados`)}
            >
              Volver al listado
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conversación abogado / cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Conversación sobre este valor agregado</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Timeline */}
          {msgsLoading ? (
            <p className="text-sm text-muted-foreground">Cargando conversación…</p>
          ) : mensajes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay respuestas. El abogado puede responder aquí y el cliente podrá
              continuar la conversación.
            </p>
          ) : (
            <div className="space-y-3">
              {mensajes.map((m) => {
                const fechaStr = formatMsgDate(m.fecha as any);
                const autorLabel = m.autorTipo === "cliente" ? "CLIENTE" : "ABOGADO";
                const isClienteMsg = m.autorTipo === "cliente";

                return (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-md border p-3 flex flex-col gap-1",
                      isClienteMsg
                        ? "border-brand-primary/40 bg-brand-primary/5"
                        : "border-slate-200 bg-slate-50"
                    )}
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <UserIcon className="h-3 w-3" />
                        <span className="font-medium text-foreground">{autorLabel}</span>
                      </div>
                      <span>{fechaStr}</span>
                    </div>

                    {m.descripcion && (
                      <div className="text-sm whitespace-pre-wrap mt-1">
                        {m.descripcion}
                      </div>
                    )}

                    {m.archivoURL && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <FileText className="h-3 w-3 text-primary" />
                        <a
                          href={m.archivoURL}
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-primary"
                        >
                          {m.archivoNombre ?? "Ver archivo adjunto"}
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Nuevo mensaje (cliente o abogado/ejecutivo) */}

          <div className="pt-4 space-y-3">
            <Separator />
            <Label>Agregar mensaje a la conversación</Label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe tu respuesta, observaciones o instrucciones…"
              className="min-h-24"
              maxLength={2000}
              disabled={msgSaving}
            />

            {/* Archivo adjunto */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Upload className="h-4 w-4" />
                Archivo adjunto (opcional)
              </Label>

              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  id="archivo-conversacion-valor"
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  disabled={msgSaving}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) {
                      setArchivoFile(undefined);
                      return;
                    }
                    const tooBig = f.size > MAX_FILE_MB * 1024 * 1024;
                    if (tooBig) {
                      toast.error(`El archivo supera ${MAX_FILE_MB} MB`);
                      e.currentTarget.value = "";
                      return;
                    }
                    setArchivoFile(f);
                  }}
                />

                <Button
                  type="button"
                  variant="outline"
                  disabled={msgSaving}
                  onClick={() =>
                    document.getElementById("archivo-conversacion-valor")?.click()
                  }
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Seleccionar archivo
                </Button>

                {archivoFile ? (
                  <div className="text-xs flex items-center gap-2">
                    <FileText className="h-3 w-3 text-brand-primary" />
                    <span className="font-medium">{archivoFile.name}</span>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    No hay archivo seleccionado
                  </div>
                )}

                {archivoFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setArchivoFile(undefined)}
                    disabled={msgSaving}
                  >
                    Quitar archivo
                  </Button>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground">
                Formatos permitidos: PDF, Word, Excel, JPG/PNG. Tamaño máximo: {MAX_FILE_MB} MB.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={onCrearMensaje}
                disabled={msgSaving || (!texto.trim() && !archivoFile)}
              >
                {msgSaving ? "Guardando…" : "Enviar respuesta"}
              </Button>
            </div>
          </div>



        </CardContent>
      </Card>
    </div>
  );
}
