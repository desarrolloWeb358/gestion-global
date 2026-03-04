import * as React from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  MessageSquare,
  FileText,
  Upload,
  Trash2,
  ExternalLink,
  CalendarDays,
} from "lucide-react";

import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import { Typography } from "@/shared/design-system/components/Typography";
import { BackButton } from "@/shared/design-system/components/BackButton";
import { cn } from "@/shared/lib/cn";

import {
  getObservacionesClienteGlobal,
  addObservacionClienteGlobal,
} from "@/modules/cobranza/services/observacionClienteGlobalService";

import { ObservacionClienteGlobal } from "@/modules/cobranza/models/observacionClienteGlobal.model";

export default function ClienteSeguimientoConjunto() {
  const { clienteId } = useParams();

  const [items, setItems] = React.useState<ObservacionClienteGlobal[]>([]);
  const [texto, setTexto] = React.useState("");
  const [archivo, setArchivo] = React.useState<File | undefined>();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function cargar() {
    if (!clienteId) return;
    setLoading(true);
    try {
      const data = await getObservacionesClienteGlobal(clienteId);
      setItems(data);
    } catch {
      toast.error("No se pudieron cargar las observaciones");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    cargar();
  }, [clienteId]);

  async function guardar() {
    if (!clienteId) return;
    if (!texto.trim()) {
      toast.error("Debes escribir un detalle");
      return;
    }
    try {
      setBusy(true);
      await addObservacionClienteGlobal(clienteId, texto, archivo);
      setTexto("");
      setArchivo(undefined);
      await cargar();
      toast.success("Seguimiento agregado");
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-3xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">

        {/* BACK */}
        <div className="flex items-center gap-2">
          <BackButton
            variant="ghost"
            size="sm"
            className="text-brand-secondary hover:text-brand-primary hover:bg-brand-primary/5 transition-all"
          />
        </div>

        {/* HEADER */}
        <header className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand-primary/10">
            <MessageSquare className="h-6 w-6 text-brand-primary" />
          </div>
          <div>
            <Typography variant="h2" className="!text-brand-primary font-bold">
              Seguimiento del conjunto
            </Typography>
            <Typography variant="small" className="text-gray-500 mt-0.5">
              Registro de observaciones y novedades del cliente
            </Typography>
          </div>
        </header>

        {/* FORMULARIO */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          {/* Header de la card */}
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 px-5 py-4 border-b border-brand-secondary/10">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-brand-primary" />
              <Typography variant="h3" className="!text-brand-secondary font-semibold">
                Nuevo seguimiento
              </Typography>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Textarea */}
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe el detalle del seguimiento..."
              disabled={busy}
              className="min-h-28 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20 resize-none"
            />

            {/* File picker */}
            <label
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-all",
                busy
                  ? "opacity-50 cursor-not-allowed border-gray-200 bg-gray-50"
                  : archivo
                  ? "border-brand-primary bg-brand-primary/5 hover:bg-brand-primary/10"
                  : "border-brand-secondary/30 bg-gray-50 hover:border-brand-primary hover:bg-brand-primary/5"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                disabled={busy}
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files?.[0]) setArchivo(e.target.files[0]);
                }}
              />

              {/* Ícono */}
              <div
                className={cn(
                  "flex-shrink-0 p-2 rounded-lg transition-colors",
                  archivo
                    ? "bg-brand-primary/15"
                    : "bg-white border border-brand-secondary/20"
                )}
              >
                {archivo ? (
                  <FileText className="h-4 w-4 text-brand-primary" />
                ) : (
                  <Upload className="h-4 w-4 text-gray-400" />
                )}
              </div>

              {/* Texto */}
              <div className="flex-1 min-w-0">
                {archivo ? (
                  <>
                    <p className="text-sm font-medium text-brand-primary truncate">
                      {archivo.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {(archivo.size / 1024).toFixed(0)} KB · Haz clic para cambiar
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-700">
                      Adjuntar archivo{" "}
                      <span className="font-normal text-gray-500">(opcional)</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      PDF, JPG, PNG, DOC
                    </p>
                  </>
                )}
              </div>

              {/* Botón quitar */}
              {archivo && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={(e) => {
                    e.preventDefault();
                    setArchivo(undefined);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </label>

            {/* Botón guardar */}
            <div className="flex justify-end">
              <Button
                onClick={guardar}
                disabled={busy}
                variant="brand"
                className="gap-2 shadow-md hover:shadow-lg transition-all"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Agregar seguimiento
              </Button>
            </div>
          </div>
        </section>

        {/* LISTADO */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Typography variant="h3" className="!text-brand-secondary font-semibold">
              Historial
            </Typography>
            {!loading && items.length > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-brand-primary text-white text-xs font-bold">
                {items.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
                <Typography variant="small" className="text-gray-500">
                  Cargando seguimientos...
                </Typography>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 rounded-full bg-brand-primary/10">
                  <MessageSquare className="h-8 w-8 text-brand-primary/50" />
                </div>
                <Typography variant="body" className="text-gray-600 font-medium">
                  Sin seguimientos registrados
                </Typography>
                <Typography variant="small" className="text-gray-400">
                  Los seguimientos que agregues aparecerán aquí
                </Typography>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((o, index) => {
                const fecha =
                  (o.fecha as any)?.toDate?.()?.toLocaleString("es-CO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }) ?? "—";

                return (
                  <div
                    key={o.id}
                    className={cn(
                      "rounded-2xl border p-4 shadow-sm transition-colors",
                      index % 2 === 0
                        ? "bg-white border-brand-secondary/20"
                        : "bg-brand-primary/[0.025] border-brand-primary/15"
                    )}
                  >
                    {/* Fecha */}
                    <div className="flex items-center gap-1.5 mb-3">
                      <CalendarDays className="h-3.5 w-3.5 text-brand-primary/60 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-500">{fecha}</span>
                    </div>

                    {/* Texto */}
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {o.texto}
                    </p>

                    {/* Archivo */}
                    {o.archivoUrl && (
                      <div className="mt-3 pt-3 border-t border-brand-secondary/10">
                        <a
                          href={o.archivoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-brand-primary hover:text-brand-secondary font-medium transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Ver archivo adjunto
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Overlay de carga global */}
      {busy && (
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="rounded-xl bg-white shadow-lg px-6 py-5 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-brand-primary" />
            <Typography variant="body" className="font-medium">
              Guardando seguimiento...
            </Typography>
          </div>
        </div>
      )}
    </div>
  );
}