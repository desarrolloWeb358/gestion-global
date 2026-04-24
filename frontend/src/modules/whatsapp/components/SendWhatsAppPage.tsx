import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import { toast } from "sonner";
import { useAuth } from "@/app/providers/AuthContext";
import { addSeguimiento } from "@/modules/cobranza/services/seguimientoService";
import { Timestamp } from "firebase/firestore";
import {
  Phone, IdCard, DollarSign, Tag, FileCheck, ArrowLeft, Send,
} from "lucide-react";
import { IconVariable } from "@tabler/icons-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/ui/select";
import { Typography } from "@/shared/design-system/components/Typography";
import { getDeudorById } from "@/modules/cobranza/services/deudorService";
import type { Deudor } from "@/modules/cobranza/models/deudores.model";
import { escucharUltimoEstadoMensual } from "@/modules/cobranza/services/estadoMensualService";
import { obtenerAcuerdoActual } from "@/modules/cobranza/services/acuerdoPagoService";
import { ACUERDO_ESTADO } from "@/shared/constants/acuerdoEstado";
import type { EstadoMensual } from "@/modules/cobranza/models/estadoMensual.model";
import { useWaNumbers } from "../hooks/useWaNumbers";
import { listenTemplates } from "../services/templatesService";
import type { WaTemplate } from "../models/waTemplate.model";

const money = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

function InfoCard({
  bg, border, iconColor, icon, label, value, sub,
}: {
  bg: string; border: string; iconColor: string;
  icon: React.ReactNode; label: string; value: string; sub?: string;
}) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${bg} border ${border}`}>
      <div className="p-1.5 rounded-lg bg-white shadow-sm flex-shrink-0">
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-500 mb-0.5 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-gray-700 leading-snug break-all">{value}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function SendWhatsAppPage() {
  const { clienteId, deudorId } = useParams<{ clienteId: string; deudorId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Deudor data
  const [deudor, setDeudor] = useState<Deudor | null>(null);
  const [estadoMes, setEstadoMes] = useState<EstadoMensual | null>(null);
  const [acuerdoActivo, setAcuerdoActivo] = useState<boolean | null>(null);

  useEffect(() => {
    if (!clienteId || !deudorId) return;
    getDeudorById(clienteId, deudorId).then(setDeudor);
    const unsub = escucharUltimoEstadoMensual(clienteId, deudorId, setEstadoMes);
    obtenerAcuerdoActual(clienteId, deudorId).then(({ acuerdo }) => {
      setAcuerdoActivo(acuerdo?.estado === ACUERDO_ESTADO.EN_FIRME);
    });
    return unsub;
  }, [clienteId, deudorId]);

  // WhatsApp numbers
  const { numbers, loading: loadingNumbers } = useWaNumbers();
  const [numberId, setNumberId] = useState("");

  useEffect(() => {
    if (numbers.length === 1) setNumberId(numbers[0].id);
  }, [numbers]);

  // Templates
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  useEffect(() => {
    if (!numberId) return;
    return listenTemplates(numberId, setTemplates);
  }, [numberId]);

  const [selectedId, setSelectedId] = useState("");
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const selectedTemplate = templates.find((t) => t.id === selectedId) ?? null;

  const handleSelectTemplate = useCallback((id: string) => {
    setSelectedId(id);
    setVarValues({});
  }, []);

  // Phone from deudor (normalized to international format)
  const rawPhone = deudor?.telefonos?.[0] ?? "";
  const intlPhone = rawPhone
    ? rawPhone.startsWith("57") && rawPhone.length >= 12
      ? rawPhone
      : `57${rawPhone}`
    : "";

  const hasPhone = !!intlPhone;

  const allVarsFilled =
    !selectedTemplate ||
    selectedTemplate.variables.every((v) => v.name === "telefono" || varValues[v.name]?.trim());

  const canSend = hasPhone && numberId && selectedId && allVarsFilled && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const parameters = selectedTemplate
        ? selectedTemplate.variables.map((v) => ({
            parameterName: v.name,
            value: v.name === "telefono" ? intlPhone : (varValues[v.name]?.trim() ?? ""),
          }))
        : [];

      const fn = httpsCallable<unknown, { ok: boolean; conversationId: string }>(
        functions,
        "sendMetaTemplate"
      );
      const result = await fn({
        numberId,
        to: intlPhone,
        templateId: selectedId,
        parameters,
        clienteId,
        deudorId,
        deudorNombre: deudor?.nombre,
      });
      toast.success("Mensaje enviado correctamente");

      if (user && clienteId && deudorId) {
        const mensajeEnviado = selectedTemplate
          ? selectedTemplate.variables.reduce(
              (text, v) =>
                text.replace(
                  new RegExp(`\\{\\{${v.name}\\}\\}`, "g"),
                  v.name === "telefono" ? intlPhone : (varValues[v.name]?.trim() ?? "")
                ),
              selectedTemplate.bodyText
            )
          : selectedId;

        await addSeguimiento(user.uid, clienteId, deudorId, {
          fecha: Timestamp.fromDate(new Date()),
          tipoSeguimiento: "whatsapp",
          descripcion: `Se envió el mensaje:\n${mensajeEnviado}\n\nNúmero: ${intlPhone}`,
        });
      }

      navigate(`/whatsapp/${numberId}/${result.data.conversationId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el mensaje");
    } finally {
      setSending(false);
    }
  };

  if (!deudor) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-gray-400">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <Typography variant="h2" className="!text-brand-secondary">
            Enviar mensaje por WhatsApp
          </Typography>
          <p className="text-sm text-gray-500 mt-0.5">{deudor.nombre}</p>
        </div>
      </div>

      {/* Sin teléfono */}
      {!hasPhone && (
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <Phone className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700">Sin número de teléfono</p>
            <p className="text-xs text-amber-600 mt-0.5">
              El deudor debe tener al menos un teléfono registrado para poder enviarle un mensaje de WhatsApp.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Panel izquierdo: formulario ──────────────────────── */}
        <div className="lg:col-span-3 space-y-5">
          <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm p-5 space-y-5">

            {/* Número de WhatsApp */}
            {!loadingNumbers && numbers.length > 1 && (
              <div className="space-y-1.5">
                <Label>Número de WhatsApp</Label>
                <Select value={numberId} onValueChange={setNumberId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un número..." />
                  </SelectTrigger>
                  <SelectContent>
                    {numbers.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Teléfono destino (bloqueado) */}
            <div className="space-y-1.5">
              <Label>Teléfono destino</Label>
              <div className="relative">
                <Input
                  value={intlPhone || "Sin teléfono registrado"}
                  readOnly
                  className="font-mono bg-gray-50 text-gray-500 cursor-not-allowed pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                  fijo
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                El número se toma del deudor y no puede modificarse.
              </p>
            </div>

            {/* Selector de plantilla */}
            <div className="space-y-1.5">
              <Label>Plantilla de mensaje</Label>
              {!numberId ? (
                <p className="text-sm text-gray-400">Selecciona un número para ver las plantillas.</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-gray-400">No hay plantillas para este número.</p>
              ) : (
                <Select value={selectedId} onValueChange={handleSelectTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una plantilla..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Preview */}
            {selectedTemplate && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-1">
                <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wide">
                  {selectedTemplate.providerTemplateName}
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {selectedTemplate.bodyText}
                </p>
              </div>
            )}

            {/* Variables */}
            {selectedTemplate && selectedTemplate.variables.length > 0 && (
              <div className="space-y-3 rounded-lg bg-brand-primary/5 border border-brand-primary/20 p-4">
                <p className="text-xs font-semibold text-brand-secondary flex items-center gap-1.5">
                  <IconVariable className="w-3.5 h-3.5" />
                  Completa las variables
                </p>
                {selectedTemplate.variables.map((v) => {
                  const isPhone = v.name === "telefono";
                  return (
                    <div key={v.name} className="space-y-1">
                      <Label htmlFor={`var-${v.name}`} className="text-xs">
                        <span className="font-mono text-brand-primary">{`{{${v.name}}}`}</span>
                        {isPhone && (
                          <span className="ml-2 text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                            automático
                          </span>
                        )}
                      </Label>
                      <Input
                        id={`var-${v.name}`}
                        value={isPhone ? intlPhone : (varValues[v.name] ?? "")}
                        readOnly={isPhone}
                        onChange={(e) =>
                          !isPhone &&
                          setVarValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                        }
                        placeholder={isPhone ? undefined : `Valor para ${v.name}`}
                        className={`h-8 text-sm ${isPhone ? "bg-gray-50 text-gray-500 cursor-not-allowed font-mono" : ""}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Botón enviar */}
            <Button
              onClick={handleSend}
              disabled={!canSend}
              className="w-full gap-2 bg-brand-primary hover:bg-brand-secondary"
              size="lg"
            >
              <Send className="h-4 w-4" />
              {sending ? "Enviando..." : "Enviar mensaje"}
            </Button>
          </div>
        </div>

        {/* ── Panel derecho: info del deudor ───────────────────── */}
        <div className="lg:col-span-2 space-y-3">
          <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 px-4 py-3 border-b border-brand-secondary/10">
              <Typography variant="h3" className="!text-brand-secondary text-sm font-semibold">
                Datos del deudor
              </Typography>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Consulta estos datos para completar los campos
              </p>
            </div>

            <div className="p-4 space-y-2.5">
              {/* Nombre */}
              <div className="pb-2 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-800 leading-snug">{deudor.nombre}</p>
                {deudor.tipificacion && (
                  <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-orange-50 border border-orange-100 text-orange-600 font-medium">
                    {deudor.tipificacion}
                  </span>
                )}
              </div>

              {/* Teléfono */}
              <InfoCard
                bg="bg-green-50" border="border-green-100" iconColor="text-green-600"
                icon={<Phone className="h-4 w-4" />}
                label="Teléfono"
                value={rawPhone || "Sin teléfono"}
              />

              {/* Documento */}
              {deudor.cedula && (
                <InfoCard
                  bg="bg-purple-50" border="border-purple-100" iconColor="text-purple-600"
                  icon={<IdCard className="h-4 w-4" />}
                  label="Documento"
                  value={deudor.cedula}
                />
              )}

              {/* Deuda */}
              <InfoCard
                bg="bg-blue-50" border="border-blue-100" iconColor="text-blue-600"
                icon={<DollarSign className="h-4 w-4" />}
                label="Deuda último mes"
                value={estadoMes ? money(estadoMes.deuda) : "Sin estados mensuales"}
                sub={estadoMes?.mes ? `Mes: ${estadoMes.mes}` : undefined}
              />

              {/* Tipificación */}
              {deudor.tipificacion && (
                <InfoCard
                  bg="bg-orange-50" border="border-orange-100" iconColor="text-orange-500"
                  icon={<Tag className="h-4 w-4" />}
                  label="Tipificación"
                  value={deudor.tipificacion}
                />
              )}

              {/* Acuerdo */}
              {acuerdoActivo !== null && (
                <div
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    acuerdoActivo ? "bg-green-50 border-green-100" : "bg-gray-50 border-gray-100"
                  }`}
                >
                  <div className="p-1.5 rounded-lg bg-white shadow-sm flex-shrink-0">
                    <FileCheck className={`h-4 w-4 ${acuerdoActivo ? "text-green-600" : "text-gray-400"}`} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Acuerdo de pago</p>
                    <p className={`text-sm font-semibold ${acuerdoActivo ? "text-green-700" : "text-gray-500"}`}>
                      {acuerdoActivo ? "En firme" : "Sin acuerdo activo"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
