import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";
import { ArrowLeft, Send, CheckCircle, XCircle, PhoneOff, ChevronDown, ChevronUp } from "lucide-react";
import { IconVariable } from "@tabler/icons-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/ui/select";
import { Typography } from "@/shared/design-system/components/Typography";
import { useAuth } from "@/app/providers/AuthContext";
import { useWaNumbers } from "../hooks/useWaNumbers";
import { listenTemplates } from "../services/templatesService";
import type { WaTemplate } from "../models/waTemplate.model";
import { obtenerDeudorPorCliente } from "@/modules/cobranza/services/deudorService";
import type { Deudor } from "@/modules/cobranza/models/deudores.model";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";
import { addSeguimiento } from "@/modules/cobranza/services/seguimientoService";

// ── Tipos ────────────────────────────────────────────────────────────────────

type VarMode = "auto" | "deudor" | "static";

interface VarSource {
  mode: VarMode;
  field?: string;  // si mode === "deudor"
  value?: string;  // si mode === "static"
}

interface SendItem {
  deudor: Deudor;
  phone: string; // ya normalizado a internacional
}

interface SendResult {
  nombre: string;
  phone: string;
  status: "ok" | "error" | "no_phone";
  error?: string;
}

// ── Constantes ───────────────────────────────────────────────────────────────

const DEUDOR_FIELD_OPTIONS = [
  { key: "nombre",    label: "Nombre" },
  { key: "cedula",    label: "Documento / Cédula" },
  { key: "ubicacion", label: "Ubicación (Apto/Unidad)" },
  { key: "direccion", label: "Dirección" },
];

const TIPIFICACIONES = Object.values(TipificacionDeuda);

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 600;

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("57") && digits.length >= 12) return digits;
  return `57${digits}`;
}

function getDeudorField(deudor: Deudor, field: string): string {
  const val = (deudor as Record<string, any>)[field];
  if (Array.isArray(val)) return String(val[0] ?? "");
  return String(val ?? "");
}

function resolveVarValue(
  varName: string,
  source: VarSource | undefined,
  deudor: Deudor,
  phone: string
): string {
  if (!source || source.mode === "auto") {
    return varName === "telefono" ? phone : "";
  }
  if (source.mode === "deudor" && source.field) {
    return getDeudorField(deudor, source.field);
  }
  if (source.mode === "static") return source.value ?? "";
  return "";
}

function resolveMessage(
  bodyText: string,
  template: WaTemplate,
  deudor: Deudor,
  phone: string,
  sources: Record<string, VarSource>
): string {
  return template.variables.reduce(
    (text, v) =>
      text.replace(
        new RegExp(`\\{\\{${v.name}\\}\\}`, "g"),
        resolveVarValue(v.name, sources[v.name], deudor, phone)
      ),
    bodyText
  );
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function BulkWhatsAppPage() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Números y plantillas
  const { numbers, loading: loadingNumbers } = useWaNumbers();
  const [numberId, setNumberId] = useState("");
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // Variables de la plantilla → cómo resolverlas
  const [varSources, setVarSources] = useState<Record<string, VarSource>>({});

  // Deudores del cliente
  const [allDeudores, setAllDeudores] = useState<Deudor[]>([]);
  const [loadingDeudores, setLoadingDeudores] = useState(true);

  // Filtro de tipificación (vacío = todos)
  const [selectedTips, setSelectedTips] = useState<string[]>([]);

  // Estado del proceso
  type Step = "config" | "sending" | "done";
  const [step, setStep] = useState<Step>("config");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<SendResult[]>([]);
  const [showFailDetail, setShowFailDetail] = useState(false);

  // ── Carga inicial ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!clienteId) return;
    setLoadingDeudores(true);
    obtenerDeudorPorCliente(clienteId)
      .then(setAllDeudores)
      .finally(() => setLoadingDeudores(false));
  }, [clienteId]);

  useEffect(() => {
    if (numbers.length === 1) setNumberId(numbers[0].id);
  }, [numbers]);

  useEffect(() => {
    if (!numberId) return;
    return listenTemplates(numberId, setTemplates);
  }, [numberId]);

  // Resetea sources al cambiar plantilla
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;
  useEffect(() => {
    if (!selectedTemplate) { setVarSources({}); return; }
    const initial: Record<string, VarSource> = {};
    for (const v of selectedTemplate.variables) {
      initial[v.name] = v.name === "telefono" ? { mode: "auto" } : { mode: "static", value: "" };
    }
    setVarSources(initial);
  }, [selectedTemplateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Deudores filtrados ─────────────────────────────────────────────────────

  const filteredDeudores = allDeudores.filter((d) =>
    selectedTips.length === 0 || selectedTips.includes(d.tipificacion as string)
  );

  const tipificacionesEnCliente = [
    ...new Set(allDeudores.map((d) => d.tipificacion as string).filter(Boolean)),
  ].sort();

  // ── Validación ─────────────────────────────────────────────────────────────

  const allStaticFilled = selectedTemplate
    ? selectedTemplate.variables.every((v) => {
        const src = varSources[v.name];
        if (!src || src.mode === "auto") return true;
        if (src.mode === "deudor") return !!src.field;
        if (src.mode === "static") return (src.value ?? "").trim() !== "";
        return true;
      })
    : false;

  const canSend =
    !!numberId && !!selectedTemplateId && allStaticFilled && filteredDeudores.length > 0;

  // ── Toggle tipificación ────────────────────────────────────────────────────

  const toggleTip = useCallback((tip: string) => {
    setSelectedTips((prev) =>
      prev.includes(tip) ? prev.filter((t) => t !== tip) : [...prev, tip]
    );
  }, []);

  // ── Envío masivo ───────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!canSend || !selectedTemplate || !clienteId || !user) return;

    // Construir lista de pares {deudor, phone}
    const items: SendItem[] = [];
    const noPhone: SendResult[] = [];

    for (const deudor of filteredDeudores) {
      const phones = (deudor.telefonos ?? []).filter(Boolean);
      if (phones.length === 0) {
        noPhone.push({ nombre: deudor.nombre, phone: "", status: "no_phone" });
      } else {
        for (const raw of phones) {
          items.push({ deudor, phone: normalizePhone(raw) });
        }
      }
    }

    const allResults: SendResult[] = [...noPhone];
    setResults(allResults);
    setProgress({ current: 0, total: items.length });
    setStep("sending");

    const fn = httpsCallable<unknown, { ok: boolean; conversationId: string }>(
      functions,
      "sendMetaTemplate"
    );

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async ({ deudor, phone }) => {
          try {
            const parameters = selectedTemplate.variables.map((v) => ({
              parameterName: v.name,
              value: resolveVarValue(v.name, varSources[v.name], deudor, phone),
            }));

            await fn({
              numberId,
              to: phone,
              templateId: selectedTemplateId,
              parameters,
              clienteId,
              deudorId: deudor.id,
              deudorNombre: deudor.nombre,
            });

            // Seguimiento prejurídico
            const mensajeTexto = resolveMessage(
              selectedTemplate.bodyText,
              selectedTemplate,
              deudor,
              phone,
              varSources
            );
            await addSeguimiento(user.uid, clienteId, deudor.id!, {
              fecha: Timestamp.fromDate(new Date()),
              tipoSeguimiento: "whatsapp",
              descripcion: `Se envió mensaje masivo:\n${mensajeTexto}\n\nNúmero: ${phone}`,
            });

            allResults.push({ nombre: deudor.nombre, phone, status: "ok" });
          } catch (err: unknown) {
            allResults.push({
              nombre: deudor.nombre,
              phone,
              status: "error",
              error: err instanceof Error ? err.message : "Error desconocido",
            });
          }
        })
      );

      setResults([...allResults]);
      setProgress({ current: Math.min(i + BATCH_SIZE, items.length), total: items.length });

      if (i + BATCH_SIZE < items.length) await delay(BATCH_DELAY_MS);
    }

    setStep("done");
    const sent = allResults.filter((r) => r.status === "ok").length;
    toast.success(`Envío completado: ${sent} mensajes enviados`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const sentCount    = results.filter((r) => r.status === "ok").length;
  const errorCount   = results.filter((r) => r.status === "error").length;
  const noPhoneCount = results.filter((r) => r.status === "no_phone").length;
  const failedItems  = results.filter((r) => r.status === "error" || r.status === "no_phone");

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

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
            Envío masivo por WhatsApp
          </Typography>
          <p className="text-sm text-gray-500 mt-0.5">
            Envía una plantilla a todos los deudores del cliente según tipificación
          </p>
        </div>
      </div>

      {/* ── Resultados (done / sending) ──────────────────────────────────── */}
      {(step === "sending" || step === "done") && (
        <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm p-5 space-y-4">
          <Typography variant="h3" className="!text-brand-secondary font-semibold">
            {step === "sending" ? "Enviando mensajes..." : "Resumen del envío"}
          </Typography>

          {/* Barra de progreso */}
          {step === "sending" && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Procesando {progress.current} de {progress.total}</span>
                <span>{Math.round((progress.current / progress.total) * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-brand-primary rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Contadores */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Enviados</p>
                <p className="text-xl font-bold text-green-700">{sentCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Fallidos</p>
                <p className="text-xl font-bold text-red-600">{errorCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <PhoneOff className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Sin número</p>
                <p className="text-xl font-bold text-amber-600">{noPhoneCount}</p>
              </div>
            </div>
          </div>

          {/* Detalle de no enviados */}
          {failedItems.length > 0 && step === "done" && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowFailDetail((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
              >
                <span>Ver detalle de no enviados ({failedItems.length})</span>
                {showFailDetail ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showFailDetail && (
                <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                  {failedItems.map((r, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                      {r.status === "no_phone"
                        ? <PhoneOff className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        : <XCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                      }
                      <div>
                        <p className="text-sm font-medium text-gray-700">{r.nombre}</p>
                        <p className="text-xs text-gray-400">
                          {r.status === "no_phone"
                            ? "Sin número de teléfono asignado"
                            : r.error ?? "Error al enviar"
                          }
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "done" && (
            <Button variant="outline" onClick={() => navigate(-1)} className="w-full">
              Volver al cliente
            </Button>
          )}
        </div>
      )}

      {/* ── Formulario de configuración ──────────────────────────────────── */}
      {step === "config" && (
        <div className="space-y-5">

          {/* Sección 1: Número + Plantilla */}
          <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm p-5 space-y-4">
            <Typography variant="h3" className="!text-brand-secondary font-semibold">
              1. Selecciona la plantilla
            </Typography>

            {!loadingNumbers && numbers.length > 1 && (
              <div className="space-y-1.5">
                <Label>Número de WhatsApp</Label>
                <Select value={numberId} onValueChange={setNumberId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un número..." />
                  </SelectTrigger>
                  <SelectContent>
                    {numbers.map((n) => (
                      <SelectItem key={n.id} value={n.id}>{n.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Plantilla de mensaje</Label>
              {!numberId ? (
                <p className="text-sm text-gray-400">Selecciona un número primero.</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-gray-400">No hay plantillas para este número.</p>
              ) : (
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una plantilla..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

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
          </div>

          {/* Sección 2: Variables */}
          {selectedTemplate && selectedTemplate.variables.length > 0 && (
            <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2">
                <IconVariable className="w-4 h-4 text-brand-primary" />
                <Typography variant="h3" className="!text-brand-secondary font-semibold">
                  2. Configura las variables
                </Typography>
              </div>
              <p className="text-xs text-gray-500 -mt-2">
                Elige si cada variable se toma del deudor o es un valor fijo para todos.
              </p>

              <div className="space-y-3">
                {selectedTemplate.variables.map((v) => {
                  const src = varSources[v.name] ?? { mode: "static", value: "" };
                  const isAuto = v.name === "telefono";

                  return (
                    <div
                      key={v.name}
                      className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start p-3 rounded-lg bg-gray-50 border border-gray-100"
                    >
                      {/* Nombre de la variable */}
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Variable</p>
                        <p className="text-sm font-mono font-semibold text-brand-primary">
                          {`{{${v.name}}}`}
                        </p>
                      </div>

                      {/* Modo */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Tipo de valor</p>
                        {isAuto ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-500">
                            Automático (teléfono del deudor)
                          </span>
                        ) : (
                          <Select
                            value={src.mode}
                            onValueChange={(mode) =>
                              setVarSources((prev) => ({
                                ...prev,
                                [v.name]: mode === "deudor"
                                  ? { mode: "deudor", field: "" }
                                  : { mode: "static", value: "" },
                              }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="deudor">Campo del deudor</SelectItem>
                              <SelectItem value="static">Valor fijo (igual para todos)</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Valor */}
                      <div>
                        {!isAuto && src.mode === "deudor" && (
                          <>
                            <p className="text-xs text-gray-500 mb-1">Campo del deudor</p>
                            <Select
                              value={src.field ?? ""}
                              onValueChange={(field) =>
                                setVarSources((prev) => ({
                                  ...prev,
                                  [v.name]: { mode: "deudor", field },
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Selecciona campo..." />
                              </SelectTrigger>
                              <SelectContent>
                                {DEUDOR_FIELD_OPTIONS.map((f) => (
                                  <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        )}
                        {!isAuto && src.mode === "static" && (
                          <>
                            <p className="text-xs text-gray-500 mb-1">Valor fijo</p>
                            <Input
                              value={src.value ?? ""}
                              onChange={(e) =>
                                setVarSources((prev) => ({
                                  ...prev,
                                  [v.name]: { mode: "static", value: e.target.value },
                                }))
                              }
                              placeholder={`Valor para ${v.name}`}
                              className="h-8 text-sm"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sección 3: Filtro por tipificación */}
          <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm p-5 space-y-4">
            <Typography variant="h3" className="!text-brand-secondary font-semibold">
              3. Filtra por tipificación
            </Typography>
            <p className="text-xs text-gray-500 -mt-2">
              Sin selección = se envía a todos los deudores del cliente.
            </p>

            {loadingDeudores ? (
              <p className="text-sm text-gray-400">Cargando deudores...</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {tipificacionesEnCliente.map((tip) => {
                    const active = selectedTips.includes(tip);
                    return (
                      <button
                        key={tip}
                        onClick={() => toggleTip(tip)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          active
                            ? "bg-brand-primary text-white border-brand-primary"
                            : "bg-white text-gray-600 border-gray-300 hover:border-brand-primary"
                        }`}
                      >
                        {tip}
                      </button>
                    );
                  })}
                </div>

                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${
                  filteredDeudores.length > 0
                    ? "bg-brand-primary/5 text-brand-secondary border border-brand-primary/20"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                  {filteredDeudores.length > 0
                    ? `${filteredDeudores.length} deudor${filteredDeudores.length !== 1 ? "es" : ""} recibirán el mensaje`
                    : "Ningún deudor coincide con el filtro seleccionado"
                  }
                </div>
              </>
            )}
          </div>

          {/* Botón de envío */}
          <Button
            onClick={handleSend}
            disabled={!canSend}
            className="w-full gap-2 bg-brand-primary hover:bg-brand-secondary"
            size="lg"
          >
            <Send className="h-4 w-4" />
            Enviar a {filteredDeudores.length} deudor{filteredDeudores.length !== 1 ? "es" : ""}
          </Button>
        </div>
      )}
    </div>
  );
}
