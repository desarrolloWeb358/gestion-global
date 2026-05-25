import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase";
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
import { obtenerEstadosMensuales } from "@/modules/cobranza/services/estadoMensualService";
import { getClienteById } from "@/modules/clientes/services/clienteService";
import { getUsuarioByUid } from "@/modules/usuarios/services/usuarioService";

// ── Tipos ────────────────────────────────────────────────────────────────────

type VarMode = "auto" | "deudor" | "static";

interface VarSource {
  mode: VarMode;
  field?: string;
  value?: string;
}

interface SendResult {
  nombre: string;
  phone: string;
  status: "ok" | "error" | "no_phone";
  error?: string;
}

// ── Constantes ───────────────────────────────────────────────────────────────

const DEUDOR_FIELD_OPTIONS = [
  { key: "nombre",      label: "Nombre" },
  { key: "cedula",      label: "Documento / Cédula" },
  { key: "ubicacion",   label: "Ubicación (Apto/Unidad)" },
  { key: "direccion",   label: "Dirección" },
  { key: "deuda",       label: "Deuda (último mes)" },
  { key: "deudaTotal",  label: "Deuda total con honorarios" },
  { key: "asesor",      label: "Asesor" },
  { key: "copropiedad", label: "Copropiedad" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("57") && digits.length >= 12) return digits;
  return `57${digits}`;
}

interface ExtraContext {
  deuda?: string;
  deudaTotal?: string;
  asesor?: string;
  copropiedad?: string;
}

function getDeudorField(deudor: Deudor, field: string, extra?: ExtraContext): string {
  if (field === "deuda") return extra?.deuda ?? "";
  if (field === "deudaTotal") return extra?.deudaTotal ?? "";
  if (field === "asesor") return extra?.asesor ?? "";
  if (field === "copropiedad") return extra?.copropiedad ?? "";
  const val = (deudor as Record<string, any>)[field];
  if (Array.isArray(val)) return String(val[0] ?? "");
  return String(val ?? "");
}

function resolveVarValue(
  varName: string,
  source: VarSource | undefined,
  deudor: Deudor,
  phone: string,
  extra?: ExtraContext
): string {
  if (!source || source.mode === "auto") {
    return varName === "telefono" ? phone : "";
  }
  if (source.mode === "deudor" && source.field) {
    return getDeudorField(deudor, source.field, extra);
  }
  if (source.mode === "static") return source.value ?? "";
  return "";
}

function resolveMessage(
  bodyText: string,
  template: WaTemplate,
  deudor: Deudor,
  phone: string,
  sources: Record<string, VarSource>,
  extra?: ExtraContext
): string {
  return template.variables.reduce(
    (text, v) =>
      text.replace(
        new RegExp(`\\{\\{${v.name}\\}\\}`, "g"),
        resolveVarValue(v.name, sources[v.name], deudor, phone, extra)
      ),
    bodyText
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function BulkWhatsAppPage() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { numbers, loading: loadingNumbers } = useWaNumbers();
  const [numberId, setNumberId] = useState("");
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const [varSources, setVarSources] = useState<Record<string, VarSource>>({});

  const [allDeudores, setAllDeudores] = useState<Deudor[]>([]);
  const [loadingDeudores, setLoadingDeudores] = useState(true);

  const [selectedTips, setSelectedTips] = useState<string[]>([]);

  type Step = "config" | "sending" | "done";
  const [step, setStep] = useState<Step>("config");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<SendResult[]>([]);
  const [showFailDetail, setShowFailDetail] = useState(false);

  // ID del job de Firestore que está corriendo
  const [jobId, setJobId] = useState<string | null>(null);

  // Datos extra del cliente (se cargan una vez)
  const [asesor, setAsesor] = useState("");
  const [copropiedad, setCopropiedad] = useState("");
  // Mapa deudorId → deuda del último mes (se carga al cambiar tipificación)
  const [deudaMap, setDeudaMap] = useState<Record<string, string>>({});
  const [deudaTotalMap, setDeudaTotalMap] = useState<Record<string, string>>({});

  // ── Carga inicial ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!clienteId) return;
    setLoadingDeudores(true);
    obtenerDeudorPorCliente(clienteId)
      .then(setAllDeudores)
      .finally(() => setLoadingDeudores(false));
  }, [clienteId]);

  // Cargar asesor y copropiedad desde el documento del cliente
  useEffect(() => {
    if (!clienteId) return;
    getClienteById(clienteId).then((cliente) => {
      if (!cliente) return;
      setCopropiedad(cliente.nombre ?? "");
      if (cliente.ejecutivoPrejuridicoId) {
        getUsuarioByUid(cliente.ejecutivoPrejuridicoId).then((u) => {
          setAsesor(u?.nombre ?? "");
        });
      }
    });
  }, [clienteId]);

  // Cargar deuda del último mes para cada deudor filtrado
  useEffect(() => {
    if (!clienteId || selectedTips.length === 0 || allDeudores.length === 0) {
      setDeudaMap({});
      return;
    }
    const deudoresFiltrados = allDeudores.filter(
      (d) => d.tipificacion && selectedTips.includes(d.tipificacion)
    );
    if (deudoresFiltrados.length === 0) { setDeudaMap({}); setDeudaTotalMap({}); return; }
    Promise.all(
      deudoresFiltrados.map(async (d) => {
        const estados = await obtenerEstadosMensuales(clienteId, d.id!);
        const ultimo = estados[0];
        const deuda = ultimo?.deuda ?? null;
        const honorarios = ultimo?.honorariosDeuda ?? null;
        const total = deuda != null ? deuda + (honorarios ?? 0) : null;
        const fmt = (n: number) => `$${n.toLocaleString("es-CO")}`;
        return {
          id: d.id!,
          deuda: deuda != null ? fmt(deuda) : "",
          total: total != null ? fmt(total) : "",
        };
      })
    ).then((entries) => {
      setDeudaMap(Object.fromEntries(entries.map((e) => [e.id, e.deuda])));
      setDeudaTotalMap(Object.fromEntries(entries.map((e) => [e.id, e.total])));
    });
  }, [clienteId, selectedTips, allDeudores]);

  useEffect(() => {
    if (numbers.length === 1) setNumberId(numbers[0].id);
  }, [numbers]);

  useEffect(() => {
    if (!numberId) return;
    return listenTemplates(numberId, setTemplates);
  }, [numberId]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;
  useEffect(() => {
    if (!selectedTemplate) { setVarSources({}); return; }
    const initial: Record<string, VarSource> = {};
    for (const v of selectedTemplate.variables) {
      initial[v.name] = v.name === "telefono" ? { mode: "auto" } : { mode: "static", value: "" };
    }
    setVarSources(initial);
  }, [selectedTemplateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Escuchar progreso del job en Firestore ─────────────────────────────────

  useEffect(() => {
    if (!jobId) return;

    const unsub = onSnapshot(doc(db, "bulkSendJobs", jobId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      setResults(data.results ?? []);
      setProgress(data.progress ?? { current: 0, total: 0 });

      if (data.status === "done") {
        setStep("done");
        const sent = (data.results ?? []).filter((r: SendResult) => r.status === "ok").length;
        toast.success(`Envío completado: ${sent} mensajes enviados`);
      } else if (data.status === "error") {
        setStep("done");
        toast.error(`Error en el envío: ${data.error ?? "Error desconocido"}`);
      }
    });

    return unsub;
  }, [jobId]);

  // ── Deudores filtrados ─────────────────────────────────────────────────────

  const filteredDeudores = selectedTips.length > 0
    ? allDeudores.filter((d) => d.tipificacion && selectedTips.includes(d.tipificacion))
    : [];

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
    !!numberId && !!selectedTemplateId && allStaticFilled && selectedTips.length > 0 && filteredDeudores.length > 0;

  // ── Selección múltiple de tipificaciones ──────────────────────────────────

  const toggleTip = useCallback((tip: string) => {
    setSelectedTips((prev) =>
      prev.includes(tip) ? prev.filter((t) => t !== tip) : [...prev, tip]
    );
  }, []);

  // ── Crear job en Firestore (el backend hace el envío) ──────────────────────

  const handleSend = async () => {
    if (!canSend || !selectedTemplate || !clienteId || !user) return;

    // Pre-calcular parámetros por deudor para que el backend no necesite lógica de resolución
    const items: Array<{
      deudorId: string;
      deudorNombre: string;
      tipificacion: string;
      phone: string;
      parameters: Array<{ parameterName: string; value: string }>;
      messageText: string;
    }> = [];
    const noPhone: Array<{ nombre: string }> = [];

    for (const deudor of filteredDeudores) {
      const phones = (deudor.telefonos ?? []).filter(Boolean);
      if (phones.length === 0) {
        noPhone.push({ nombre: deudor.nombre });
      } else {
        for (const raw of phones) {
          const phone = normalizePhone(raw);
          const extra: ExtraContext = {
            deuda: deudaMap[deudor.id!],
            deudaTotal: deudaTotalMap[deudor.id!],
            asesor,
            copropiedad,
          };
          const parameters = selectedTemplate.variables.map((v) => ({
            parameterName: v.name,
            value: resolveVarValue(v.name, varSources[v.name], deudor, phone, extra),
          }));
          const messageText = resolveMessage(
            selectedTemplate.bodyText,
            selectedTemplate,
            deudor,
            phone,
            varSources,
            extra
          );
          items.push({
            deudorId: deudor.id!,
            deudorNombre: deudor.nombre,
            tipificacion: deudor.tipificacion ?? "",
            phone,
            parameters,
            messageText,
          });
        }
      }
    }

    // Crear documento en bulkSendJobs — el trigger del backend lo procesa automáticamente
    const jobRef = await addDoc(collection(db, "bulkSendJobs"), {
      status: "pending",
      numberId,
      templateId: selectedTemplateId,
      clienteId,
      agentId: user.uid,
      items,
      noPhone,
      progress: { current: 0, total: items.length },
      results: noPhone.map((n) => ({ nombre: n.nombre, phone: "", status: "no_phone" })),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setJobId(jobRef.id);
    setProgress({ current: 0, total: items.length });
    setResults(noPhone.map((n) => ({ nombre: n.nombre, phone: "", status: "no_phone" as const })));
    setStep("sending");
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
                <span>
                  {progress.total > 0
                    ? `${Math.round((progress.current / progress.total) * 100)}%`
                    : "0%"}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-brand-primary rounded-full transition-all duration-300"
                  style={{
                    width: progress.total > 0
                      ? `${(progress.current / progress.total) * 100}%`
                      : "0%",
                  }}
                />
              </div>
              <p className="text-xs text-gray-400 text-center">
                Puedes cerrar esta ventana — el envío continúa en segundo plano
              </p>
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
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Variable</p>
                        <p className="text-sm font-mono font-semibold text-brand-primary">
                          {`{{${v.name}}}`}
                        </p>
                      </div>

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
              Selecciona una o varias tipificaciones. Se enviará a todos los deudores de las tipificaciones elegidas.
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
                  selectedTips.length === 0
                    ? "bg-gray-50 text-gray-500 border border-gray-200"
                    : filteredDeudores.length > 0
                    ? "bg-brand-primary/5 text-brand-secondary border border-brand-primary/20"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                  {selectedTips.length === 0
                    ? "0 deudores — selecciona al menos una tipificación para continuar"
                    : filteredDeudores.length > 0
                    ? `${filteredDeudores.length} deudor${filteredDeudores.length !== 1 ? "es" : ""} recibirán el mensaje (${selectedTips.length} tipificación${selectedTips.length !== 1 ? "es" : ""})`
                    : "Ningún deudor tiene las tipificaciones seleccionadas"
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
            {selectedTips.length > 0 && filteredDeudores.length > 0
              ? `Enviar a ${filteredDeudores.length} deudor${filteredDeudores.length !== 1 ? "es" : ""} · ${selectedTips.length} tipificación${selectedTips.length !== 1 ? "es" : ""}`
              : "Selecciona al menos una tipificación para enviar"
            }
          </Button>
        </div>
      )}
    </div>
  );
}
