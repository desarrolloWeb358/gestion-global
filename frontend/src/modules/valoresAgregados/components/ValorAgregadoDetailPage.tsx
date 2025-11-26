"use client";

import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import { toast } from "sonner";
import { Upload, FileText, User as UserIcon, Calendar, Tag, MessageSquare, Send } from "lucide-react";

import {
  obtenerValorAgregado,
  timestampToDateInput,
  listarConversacionValorAgregado,
  crearMensajeConversacionValorAgregado,
} from "../services/valorAgregadoService";

import { ValorAgregado } from "../models/valorAgregado.model";
import { MensajeValorAgregado } from "../models/mensajeValorAgregado.model";
import { TipoValorAgregadoLabels } from "../../../shared/constants/tipoValorAgregado";

import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import { Typography } from "@/shared/design-system/components/Typography";
import { BackButton } from "@/shared/design-system/components/BackButton";
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
  const canView = can(PERMS.Valores_Read);
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
      toast.success("✓ Mensaje enviado correctamente");
    } catch (e) {
      console.error(e);
      toast.error("⚠️ No se pudo guardar el mensaje");
    } finally {
      setMsgSaving(false);
    }
  }

  // ===== Guards
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-4" />
          <Typography variant="body" className="text-gray-600">
            Cargando detalle...
          </Typography>
        </div>
      </div>
    );
  }

  if (!item || !canView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <Typography variant="h2" className="text-brand-secondary mb-2">
            {!canView ? "Acceso denegado" : "No encontrado"}
          </Typography>
          <Typography variant="body" className="text-gray-600 mb-4">
            {!canView
              ? "No tienes permisos para ver valores agregados"
              : "No se encontró el registro solicitado"}
          </Typography>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Volver
          </Button>
        </div>
      </div>
    );
  }

  // ===== Render
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        
        {/* HEADER */}
        <header className="space-y-4">
          <div className="flex items-center gap-2">
            <BackButton
              variant="ghost"
              size="sm"
              to={`/valores-agregados/${clienteId}`}
              className="text-brand-secondary hover:text-brand-primary hover:bg-brand-primary/5 transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-primary/10">
              <FileText className="h-6 w-6 text-brand-primary" />
            </div>
            <div>
              <Typography variant="h2" className="!text-brand-primary font-bold">
                {item.titulo}
              </Typography>
              <Typography variant="small" className="text-gray-600 mt-0.5">
                Valor Agregado
              </Typography>
            </div>
          </div>
        </header>

        {/* DETALLE DEL VALOR AGREGADO */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <Typography variant="h3" className="!text-brand-secondary font-semibold">
              Información de la solicitud
            </Typography>
          </div>
          <div className="p-4 md:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Calendar className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Fecha de solicitud</div>
                  <div className="text-base font-semibold text-gray-900">
                    {timestampToDateInput(item.fecha as any) || "—"}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Tag className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Tipo</div>
                  <div className="text-base font-semibold text-gray-900">
                    {TipoValorAgregadoLabels[item.tipo]}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600 mb-1">Detalle</div>
              <div className="text-base text-gray-900 whitespace-pre-wrap">
                {item.descripcion || "—"}
              </div>
            </div>

            {item.archivoURL && (
              <div className="rounded-lg border border-brand-secondary/20 bg-gray-50 p-4">
                <div className="text-sm text-gray-600 mb-2">Archivo adjunto</div>
                <a
                  href={item.archivoURL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-brand-primary hover:text-brand-secondary transition-colors font-medium"
                >
                  <FileText className="h-4 w-4" />
                  {item.archivoNombre ?? "Ver archivo"}
                </a>
              </div>
            )}
          </div>
        </section>

        {/* CONVERSACIÓN */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-brand-primary" />
              <Typography variant="h3" className="!text-brand-secondary font-semibold">
                Conversación
              </Typography>
            </div>
          </div>

          <div className="p-4 md:p-5 space-y-4">
            {/* Timeline de mensajes */}
            {msgsLoading ? (
              <div className="text-center py-8">
                <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-3" />
                <Typography variant="small" className="text-gray-600">
                  Cargando conversación...
                </Typography>
              </div>
            ) : mensajes.length === 0 ? (
              <div className="text-center py-8">
                <div className="p-3 rounded-full bg-brand-primary/10 inline-block mb-3">
                  <MessageSquare className="h-6 w-6 text-brand-primary/60" />
                </div>
                <Typography variant="body" className="text-gray-600">
                  Aún no hay mensajes en esta conversación
                </Typography>
              </div>
            ) : (
              <div className="space-y-3">
                {mensajes.map((m) => {
                  const fechaStr = formatMsgDate(m.fecha as any);
                  const autorLabel = m.autorTipo === "cliente" ? "Cliente" : "Abogado";
                  const isClienteMsg = m.autorTipo === "cliente";

                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-lg border p-4 transition-colors",
                        isClienteMsg
                          ? "bg-blue-50/50 border-blue-200"
                          : "bg-white border-gray-200"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "p-1.5 rounded-full",
                            isClienteMsg ? "bg-blue-100" : "bg-gray-100"
                          )}>
                            <UserIcon className={cn(
                              "h-3 w-3",
                              isClienteMsg ? "text-blue-600" : "text-gray-600"
                            )} />
                          </div>
                          <span className="text-sm font-semibold text-gray-900">
                            {autorLabel}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">{fechaStr}</span>
                      </div>

                      {m.descripcion && (
                        <div className="text-sm text-gray-700 whitespace-pre-wrap">
                          {m.descripcion}
                        </div>
                      )}

                      {m.archivoURL && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <a
                            href={m.archivoURL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-brand-primary hover:text-brand-secondary transition-colors font-medium"
                          >
                            <FileText className="h-4 w-4" />
                            {m.archivoNombre ?? "Ver archivo adjunto"}
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Nuevo mensaje */}
            <div className="pt-4 border-t border-gray-200">
              <Typography variant="body" className="font-semibold text-brand-secondary mb-3">
                Agregar mensaje
              </Typography>
              
              <div className="space-y-3">
                <Textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Escribe tu mensaje..."
                  className="min-h-28 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                  maxLength={2000}
                  disabled={msgSaving}
                />

                {/* Archivo adjunto */}
                <div className="space-y-2">
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

                  <div className="flex items-center gap-3 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={msgSaving}
                      onClick={() =>
                        document.getElementById("archivo-conversacion-valor")?.click()
                      }
                      className="border-brand-secondary/30"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Adjuntar archivo
                    </Button>

                    {archivoFile && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">
                          {archivoFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setArchivoFile(undefined)}
                          disabled={msgSaving}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-600">
                    Formatos: PDF, Word, Excel, JPG/PNG. Máx: {MAX_FILE_MB} MB
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={onCrearMensaje}
                    disabled={msgSaving || (!texto.trim() && !archivoFile)}
                    variant="brand"
                    className="gap-2"
                  >
                    {msgSaving ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Enviar mensaje
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}