import * as React from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  MessageSquare,
  FileText,
  Upload,
  ExternalLink,
  CalendarDays,
} from "lucide-react";

import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";

import {
  getNotasInternas,
  addNotaInterna,
} from "@/modules/cobranza/services/notasInternasClienteService";

import {
  getObservacionesClienteGlobal,
  addObservacionClienteGlobal,
} from "@/modules/cobranza/services/observacionClienteGlobalService";

import { notificarUsuarioConAlertaYCorreo } from "@/modules/notificaciones/services/notificacionService";

import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import { Typography } from "@/shared/design-system/components/Typography";
import AppBreadcrumb from "@/shared/components/app-breadcrumb";
import { getClienteById } from "@/modules/clientes/services/clienteService";
import { cn } from "@/shared/lib/cn";

import { ObservacionClienteGlobal } from "@/modules/cobranza/models/observacionClienteGlobal.model";

import { db } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function ClienteSeguimientoConjunto() {

  const { clienteId } = useParams();
  const { roles, usuario } = useUsuarioActual();

  const esCliente = roles?.includes("cliente");

  const [clienteNombre, setClienteNombre] = React.useState("Cliente");
  const [items, setItems] = React.useState<ObservacionClienteGlobal[]>([]);
  const [texto, setTexto] = React.useState("");
  const [archivo, setArchivo] = React.useState<File | undefined>();

  const [notasInternas, setNotasInternas] = React.useState<any[]>([]);
  const [notaInternaTexto, setNotaInternaTexto] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  async function cargarNotasInternas() {
    if (!clienteId || esCliente) return;

    const data = await getNotasInternas(clienteId);
    setNotasInternas(data);
  }

  React.useEffect(() => {
    cargar();
    cargarNotasInternas();
  }, [clienteId]);

  React.useEffect(() => {
    if (!clienteId) return;
    getClienteById(clienteId).then((c) => {
      setClienteNombre(c?.nombre?.trim() || "Cliente");
    });
  }, [clienteId]);

  async function guardarNotaInterna() {

    if (!clienteId) return;

    if (!notaInternaTexto.trim()) {
      toast.error("Debes escribir una nota");
      return;
    }

    try {

      await addNotaInterna(clienteId, notaInternaTexto);

      setNotaInternaTexto("");

      await cargarNotasInternas();

      toast.success("Nota interna guardada");

    } catch {

      toast.error("No se pudo guardar la nota");

    }

  }

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

        <div className="flex items-center gap-2">
          <AppBreadcrumb
            items={[
              { label: "Clientes", href: "/clientes-tables" },
              { label: clienteNombre, href: `/deudores/${clienteId}` },
              { label: "Seguimiento Conjunto" },
            ]}
          />
        </div>

        <header className="flex items-center gap-3">

          <div className="p-2.5 rounded-xl bg-brand-primary/10">
            <MessageSquare className="h-6 w-6 text-brand-primary" />
          </div>

          <div>

            <Typography variant="h2" className="!text-brand-primary font-bold">
              Seguimiento del conjunto
            </Typography>

            <Typography variant="small" className="text-gray-500">
              Registro de observaciones y novedades del cliente
            </Typography>

          </div>

        </header>

        {/* NUEVO MENSAJE */}

        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">

          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 px-5 py-4 border-b">

            <div className="flex items-center gap-2">

              <Plus className="h-4 w-4 text-brand-primary" />

              <Typography variant="h3" className="!text-brand-secondary font-semibold">
                Nuevo seguimiento
              </Typography>

            </div>

          </div>

          <div className="p-5 space-y-4">

            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe el detalle del seguimiento..."
              disabled={busy}
              className="min-h-28 border-brand-secondary/30"
            />

            <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-brand-secondary/30 cursor-pointer">

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

              <Upload className="h-4 w-4 text-gray-400" />

              <span className="text-sm text-gray-600">
                Adjuntar archivo (opcional)
              </span>

            </label>

            <div className="flex justify-end">

              <Button
                onClick={guardar}
                disabled={busy}
                variant="brand"
                className="gap-2"
              >

                {busy
                  ? <Loader2 className="h-4 w-4 animate-spin"/>
                  : <Plus className="h-4 w-4"/>}

                Agregar seguimiento

              </Button>

            </div>

          </div>

        </section>

        {/* HISTORIAL */}

        <section className="space-y-3">

          <Typography variant="h3" className="!text-brand-secondary font-semibold">
            Historial
          </Typography>

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
                  "rounded-2xl border p-4 shadow-sm",
                  index % 2 === 0
                    ? "bg-white border-brand-secondary/20"
                    : "bg-brand-primary/[0.025] border-brand-primary/15"
                )}
              >

                <div className="flex items-center justify-between mb-2">

                  <span className="text-xs font-semibold text-brand-primary">
                    {o.usuarioId === usuario?.uid ? "Tú" : esCliente ? "Ejecutivo" : "Cliente"}
                  </span>

                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5"/>
                    {fecha}
                  </span>

                </div>

                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {o.texto}
                </p>

                {o.archivoUrl && (

                  <a
                    href={o.archivoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-brand-primary mt-3"
                  >

                    <FileText className="h-3.5 w-3.5"/>

                    Ver archivo adjunto

                    <ExternalLink className="h-3 w-3"/>

                  </a>

                )}

              </div>

            );

          })}

        </section>

        {/* NOTAS INTERNAS */}

        {!esCliente && (

          <section className="space-y-3 pt-6">

            <Typography
              variant="h3"
              className="!text-brand-secondary font-semibold"
            >
              Notas internas del ejecutivo
            </Typography>

            <Textarea
              value={notaInternaTexto}
              onChange={(e)=>setNotaInternaTexto(e.target.value)}
              placeholder="Registrar información interna del conjunto..."
              className="min-h-24 border-brand-secondary/30"
            />

            <div className="flex justify-end">

              <Button
                onClick={guardarNotaInterna}
                variant="brand"
              >
                Guardar nota interna
              </Button>

            </div>

            {notasInternas.length === 0 ? (

              <div className="rounded-2xl border border-brand-secondary/20 bg-white p-6 text-center shadow-sm">

                <Typography variant="body" className="text-gray-600">
                  No hay notas internas registradas
                </Typography>

              </div>

            ) : (

              <div className="space-y-3">

                {notasInternas.map((n, index) => {

                  const fecha =
                    (n.fecha as any)?.toDate?.()?.toLocaleString("es-CO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }) ?? "—";

                  return (

                    <div
                      key={n.id}
                      className="rounded-2xl border p-4 shadow-sm"
                    >

                      <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                        <CalendarDays className="h-3.5 w-3.5"/>
                        {fecha}
                      </div>

                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {n.texto}
                      </p>

                    </div>

                  );

                })}

              </div>

            )}

          </section>

        )}

      </div>

    </div>

  );

}