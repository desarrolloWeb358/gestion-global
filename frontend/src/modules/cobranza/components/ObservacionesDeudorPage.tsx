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

  // Edición inline
  const [editandoId, setEditandoId] = React.useState<string | null>(null);
  const [editTexto, setEditTexto] = React.useState("");
  const [savingEdit, setSavingEdit] = React.useState(false);

  // Cargar nombres
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

  // Cargar observaciones
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

  // Agregar observación
  async function handleGuardar() {
    if (!clienteId || !deudorId || !usuario?.uid) return;
    if (!texto.trim()) {
      toast.error("Escribe una observación antes de guardar");
      return;
    }
    setBusy(true);
    try {
      await addObservacionDeudor(
        clienteId,
        deudorId,
        texto.trim(),
        usuario.uid,
        archivo
      );
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

  // Guardar edición
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-3xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">

        {/* Breadcrumb */}
        <AppBreadcrumb
          items={[
            { label: "Clientes", href: "/clientes-tables" },
            { label: clienteNombre, href: `/deudores/${clienteId}` },
            { label: deudorLabel, href: `/clientes/${clienteId}/deudores/${deudorId}` },
            { label: "Observaciones" },
          ]}
        />

        {/* Header */}
        <header className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-brand-primary/10">
            <MessageSquare className="h-6 w-6 text-brand-primary" />
          </div>
          <div>
            <Typography variant="h2" className="!text-brand-primary font-bold">
              Observaciones
            </Typography>
            <Typography variant="small" className="text-gray-500">
              {deudorLabel}
            </Typography>
          </div>
        </header>

        {/* Formulario — solo deudor */}
        {esDeudor && (
          <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 px-5 py-4 border-b flex items-center gap-2">
              <Plus className="h-4 w-4 text-brand-primary" />
              <Typography variant="h3" className="!text-brand-secondary font-semibold">
                Nueva observación
              </Typography>
            </div>

            <div className="p-5 space-y-4">
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escribe tu observación..."
                disabled={busy}
                className="min-h-28 border-brand-secondary/30"
              />

              {/* Adjuntar archivo */}
              <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-brand-secondary/30 cursor-pointer hover:border-brand-primary/40 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  disabled={busy}
                  className="sr-only"
                  onChange={(e) => setArchivo(e.target.files?.[0])}
                />
                <Upload className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-600">
                  {archivo ? archivo.name : "Adjuntar archivo (opcional)"}
                </span>
                {archivo && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setArchivo(undefined);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="ml-auto text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </label>

              <div className="flex justify-end">
                <Button
                  onClick={handleGuardar}
                  disabled={busy}
                  variant="brand"
                  className="gap-2"
                >
                  {busy
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Plus className="h-4 w-4" />}
                  Guardar observación
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* Historial */}
        <section className="space-y-3">
          <Typography variant="h3" className="!text-brand-secondary font-semibold">
            Historial
          </Typography>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-brand-secondary/20 bg-white p-8 text-center shadow-sm">
              <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <Typography variant="body" className="text-gray-500">
                No hay observaciones registradas
              </Typography>
            </div>
          ) : (
            items.map((obs, index) => {
              const fecha =
                (obs.fecha as any)?.toDate?.()?.toLocaleString("es-CO", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }) ?? "—";

              const esMia = obs.usuarioId === usuario?.uid;
              const enEdicion = editandoId === obs.id;

              return (
                <div
                  key={obs.id}
                  className={cn(
                    "rounded-2xl border p-4 shadow-sm",
                    index % 2 === 0
                      ? "bg-white border-brand-secondary/20"
                      : "bg-brand-primary/[0.025] border-brand-primary/15"
                  )}
                >
                  {/* Cabecera */}
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="text-xs font-semibold text-brand-primary">
                      {esMia ? "Tú" : "Deudor"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {fecha}
                      </span>
                      {/* Editar — solo el propio deudor */}
                      {esDeudor && esMia && !enEdicion && (
                        <button
                          onClick={() => {
                            setEditandoId(obs.id!);
                            setEditTexto(obs.texto);
                          }}
                          className="text-gray-400 hover:text-brand-primary transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Contenido / editor */}
                  {enEdicion ? (
                    <div className="space-y-2 mt-1">
                      <Textarea
                        value={editTexto}
                        onChange={(e) => setEditTexto(e.target.value)}
                        className="min-h-20 border-brand-secondary/30 text-sm"
                        disabled={savingEdit}
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditandoId(null)}
                          disabled={savingEdit}
                          className="gap-1"
                        >
                          <X className="h-3.5 w-3.5" /> Cancelar
                        </Button>
                        <Button
                          size="sm"
                          variant="brand"
                          onClick={() => handleGuardarEdicion(obs.id!)}
                          disabled={savingEdit}
                          className="gap-1"
                        >
                          {savingEdit
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Check className="h-3.5 w-3.5" />}
                          Guardar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {obs.texto}
                    </p>
                  )}

                  {/* Archivo adjunto */}
                  {obs.archivoUrl && !enEdicion && (
                    <a
                      href={obs.archivoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-brand-primary mt-3 hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {obs.archivoNombre || "Ver archivo adjunto"}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              );
            })
          )}
        </section>

      </div>
    </div>
  );
}
