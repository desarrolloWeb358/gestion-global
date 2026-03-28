import * as React from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  MessageSquare,
  Upload,
  FileText,
  ExternalLink,
  CalendarDays,
  Pencil,
  Check,
  X,
  ClipboardList,
} from "lucide-react";

import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { getClienteById } from "@/modules/clientes/services/clienteService";
import { getDeudorById } from "@/modules/cobranza/services/deudorService";
import {
  getObservacionesDeudor,
  addObservacionDeudor,
  updateObservacionDeudor,
  type ObservacionDeudor,
} from "@/modules/cobranza/services/observacionesDeudorService";

import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import { Typography } from "@/shared/design-system/components/Typography";
import AppBreadcrumb from "@/shared/components/app-breadcrumb";
import { cn } from "@/shared/lib/cn";

const MAX_CHARS = 1000;

export default function ObservacionesDeudorPage() {
  const { clienteId, deudorId } = useParams<{
    clienteId: string;
    deudorId: string;
  }>();

  const { roles, usuario } = useUsuarioActual();
  const esDeudor = roles?.includes("deudor");

  const [clienteNombre, setClienteNombre] = React.useState("Cliente");
  const [deudorNombre, setDeudorNombre] = React.useState("Deudor");
  const [ubicacionDeudor, setUbicacionDeudor] = React.useState("");

  const [items, setItems] = React.useState<ObservacionDeudor[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const [texto, setTexto] = React.useState("");
  const [archivo, setArchivo] = React.useState<File | undefined>();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const [editTexto, setEditTexto] = React.useState("");
  const [savingEdit, setSavingEdit] = React.useState(false);

  React.useEffect(() => {
    if (!clienteId || !deudorId) return;
    Promise.all([
      getClienteById(clienteId),
      getDeudorById(clienteId, deudorId),
    ]).then(([c, d]) => {
      setClienteNombre(c?.nombre?.trim() || "Cliente");
      setDeudorNombre(d?.nombre?.trim() || "Deudor");
      setUbicacionDeudor(d?.ubicacion?.trim() || "");
    });
  }, [clienteId, deudorId]);

  async function cargar() {
    if (!clienteId || !deudorId) return;
    setLoading(true);
    try {
      const data = await getObservacionesDeudor(clienteId, deudorId);
      setItems(data);
    } catch {
      toast.error("No se pudieron cargar las observaciones");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    cargar();
  }, [clienteId, deudorId]);

  async function handleGuardar() {
    if (!clienteId || !deudorId || !usuario?.uid) return;
    if (!texto.trim()) {
      toast.error("Escribe una observación antes de guardar");
      return;
    }
    setBusy(true);
    try {
      await addObservacionDeudor(clienteId, deudorId, texto.trim(), usuario.uid, archivo);
      setTexto("");
      setArchivo(undefined);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await cargar();
      toast.success("Observación guardada");
    } catch {
      toast.error("No se pudo guardar la observación");
    } finally {
      setBusy(false);
    }
  }

  async function handleGuardarEdicion(obsId: string) {
    if (!clienteId || !deudorId) return;
    if (!editTexto.trim()) {
      toast.error("El texto no puede estar vacío");
      return;
    }
    setSavingEdit(true);
    try {
      await updateObservacionDeudor(clienteId, deudorId, obsId, editTexto.trim());
      setEditandoId(null);
      await cargar();
      toast.success("Observación actualizada");
    } catch {
      toast.error("No se pudo actualizar");
    } finally {
      setSavingEdit(false);
    }
  }

  const deudorLabel = `${deudorNombre}${ubicacionDeudor ? ` - ${ubicacionDeudor}` : ""}`;
  const charsLeft = MAX_CHARS - texto.length;

  return (
    <div className="min-h-screen bg-gray-50/60">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Breadcrumb */}
        <AppBreadcrumb
          items={[
            ...(!esDeudor ? [{ label: "Clientes", href: "/clientes-tables" }] : []),
            { label: clienteNombre, href: esDeudor ? `/clientes/${clienteId}/deudores/${deudorId}` : `/deudores/${clienteId}` },
            ...(!esDeudor ? [{ label: deudorLabel, href: `/clientes/${clienteId}/deudores/${deudorId}` }] : []),
            { label: "Observaciones" },
          ]}
        />

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 shrink-0">
              <MessageSquare className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <Typography variant="h2" className="font-bold text-gray-900 !text-xl">
                Observaciones
              </Typography>
              <Typography variant="small" className="text-gray-500 truncate max-w-xs">
                {deudorLabel}
              </Typography>
            </div>
          </div>
          {!loading && items.length > 0 && (
            <span className="shrink-0 px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-semibold">
              {items.length} {items.length === 1 ? "registro" : "registros"}
            </span>
          )}
        </div>

        {/* Formulario — solo deudor */}
        {esDeudor && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50/50 flex items-center gap-2">
              <Plus className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-gray-700">Nueva observación</span>
            </div>

            <div className="p-5 space-y-3">
              <div className="relative">
                <Textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value.slice(0, MAX_CHARS))}
                  placeholder="Describe tu observación con el mayor detalle posible..."
                  disabled={busy}
                  className="min-h-28 resize-none border-gray-200 focus:border-amber-400 focus:ring-amber-100 text-sm pr-2"
                />
                <span
                  className={cn(
                    "absolute bottom-2.5 right-3 text-xs tabular-nums",
                    charsLeft < 100 ? "text-amber-500" : "text-gray-300"
                  )}
                >
                  {charsLeft}
                </span>
              </div>

              {/* Zona de archivo */}
              <label
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors",
                  archivo
                    ? "border-amber-300 bg-amber-50/50"
                    : "border-gray-200 hover:border-amber-300 hover:bg-amber-50/30"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  disabled={busy}
                  className="sr-only"
                  onChange={(e) => setArchivo(e.target.files?.[0])}
                />
                {archivo ? (
                  <>
                    <FileText className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-sm text-gray-700 truncate flex-1">{archivo.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setArchivo(undefined);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-400">
                      Adjuntar archivo <span className="text-gray-300">(PDF, imagen, Word)</span>
                    </span>
                  </>
                )}
              </label>

              <div className="flex justify-end pt-1">
                <Button
                  onClick={handleGuardar}
                  disabled={busy || !texto.trim()}
                  className="gap-2 bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-sm"
                >
                  {busy
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Check className="h-4 w-4" />}
                  Guardar observación
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Historial */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Historial
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-brand-primary/40" />
              <Typography variant="small" className="text-gray-400">
                Cargando observaciones...
              </Typography>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl border border-dashed border-gray-200 bg-white">
              <div className="p-4 rounded-full bg-gray-50 border border-gray-100">
                <MessageSquare className="h-7 w-7 text-gray-300" />
              </div>
              <div className="text-center">
                <Typography variant="body" className="text-gray-500 font-medium">
                  Sin observaciones aún
                </Typography>
                <Typography variant="small" className="text-gray-400 mt-0.5">
                  {esDeudor
                    ? "Usa el formulario de arriba para agregar la primera."
                    : "El deudor no ha registrado observaciones."}
                </Typography>
              </div>
            </div>
          ) : (
            /* Timeline */
            <div className="relative">
              {/* Línea vertical */}
              <div className="absolute left-4 top-4 bottom-4 w-px bg-gray-100" />

              <div className="space-y-3">
                {items.map((obs) => {
                  const fecha =
                    (obs.fecha as any)?.toDate?.()?.toLocaleString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }) ?? "—";

                  const esMia = obs.usuarioId === usuario?.uid;
                  const enEdicion = editandoId === obs.id;

                  return (
                    <div key={obs.id} className="relative flex gap-4 pl-10">
                      {/* Dot en la línea */}
                      <div
                        className={cn(
                          "absolute left-2.5 top-4 w-3 h-3 rounded-full border-2 bg-white shrink-0",
                          esMia ? "border-amber-400" : "border-brand-primary/40"
                        )}
                      />

                      {/* Card */}
                      <div
                        className={cn(
                          "flex-1 rounded-xl border shadow-sm overflow-hidden",
                          esMia
                            ? "bg-white border-amber-100"
                            : "bg-white border-gray-100"
                        )}
                      >
                        {/* Card header */}
                        <div
                          className={cn(
                            "flex items-center justify-between px-4 py-2.5 border-b",
                            esMia
                              ? "bg-amber-50/60 border-amber-100/80"
                              : "bg-gray-50/60 border-gray-100"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                                esMia
                                  ? "bg-amber-200 text-amber-700"
                                  : "bg-brand-primary/10 text-brand-primary"
                              )}
                            >
                              {esMia ? "Tú" : "D"}
                            </div>
                            <span
                              className={cn(
                                "text-xs font-semibold",
                                esMia ? "text-amber-700" : "text-brand-primary"
                              )}
                            >
                              {esMia ? "Tú" : "Deudor"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-gray-400 flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {fecha}
                            </span>
                            {esDeudor && esMia && !enEdicion && (
                              <button
                                onClick={() => {
                                  setEditandoId(obs.id!);
                                  setEditTexto(obs.texto);
                                }}
                                className="text-gray-300 hover:text-amber-500 transition-colors"
                                title="Editar"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Card body */}
                        <div className="px-4 py-3">
                          {enEdicion ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editTexto}
                                onChange={(e) => setEditTexto(e.target.value)}
                                className="min-h-20 text-sm border-gray-200 focus:border-amber-400 resize-none"
                                disabled={savingEdit}
                                autoFocus
                              />
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditandoId(null)}
                                  disabled={savingEdit}
                                  className="gap-1 text-gray-500 h-8 text-xs"
                                >
                                  <X className="h-3.5 w-3.5" /> Cancelar
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleGuardarEdicion(obs.id!)}
                                  disabled={savingEdit}
                                  className="gap-1 bg-amber-500 hover:bg-amber-600 text-white border-0 h-8 text-xs"
                                >
                                  {savingEdit
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Check className="h-3.5 w-3.5" />}
                                  Guardar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                              {obs.texto}
                            </p>
                          )}

                          {/* Archivo adjunto */}
                          {obs.archivoUrl && !enEdicion && (
                            <a
                              href={obs.archivoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-colors group"
                            >
                              <FileText className="h-3.5 w-3.5 text-gray-400 group-hover:text-brand-primary transition-colors" />
                              <span className="text-xs text-gray-600 truncate max-w-[200px]">
                                {obs.archivoNombre || "Archivo adjunto"}
                              </span>
                              <ExternalLink className="h-3 w-3 text-gray-300 group-hover:text-brand-primary transition-colors" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
