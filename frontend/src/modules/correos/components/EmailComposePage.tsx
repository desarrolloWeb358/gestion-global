import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot } from "firebase/firestore";
import { ArrowLeft, CheckCircle, Mail, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { db, functions } from "@/firebase";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Typography } from "@/shared/design-system/components/Typography";
import { getClienteById } from "@/modules/clientes/services/clienteService";
import { getDeudorById, obtenerDeudorPorCliente } from "@/modules/cobranza/services/deudorService";
import type { Deudor } from "@/modules/cobranza/models/deudores.model";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";
import { EMAIL_TEMPLATES, EMAIL_VARIABLES } from "../emailTemplates";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import { getUsuarioByUid } from "@/modules/usuarios/services/usuarioService";

interface SendResult {
  to: string;
  deudorNombre: string;
  status: "ok" | "error";
  error?: string;
}

/** Estado en vivo de la campaña, leído del documento `emailCampaigns/{id}`. */
interface CampaignProgress {
  status: "queued" | "sending" | "done" | string;
  total: number;
  processed: number;
  sent: number;
  failed: number;
  results?: SendResult[];
}

/** Una campaña ya enviada a este conjunto, para el historial de la misma pantalla. */
interface CampaignHistoryItem {
  id: string;
  mode: "bulk" | "individual" | "conjunto";
  subject: string;
  body: string;
  attachmentNames: string[];
  total: number;
  sent: number;
  failed: number;
  status: string;
  createdAtMs: number;
}

type Destino = "deudores" | "conjunto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Tipificaciones que ya salieron de la gestión de cobro. No se incluyen en el
 * cuadro de deudores que se le manda a la administración del conjunto: pedir el
 * estado de cuenta de alguien que ya pagó o que fue devuelto es un error frente
 * al cliente.
 */
const TIPIFICACIONES_FUERA_DE_GESTION = new Set<string>([
  TipificacionDeuda.INACTIVO,
  TipificacionDeuda.TERMINADO,
  TipificacionDeuda.DEVUELTO,
  TipificacionDeuda.DEMANDA_TERMINADO,
]);

/**
 * Se calcula en cada render (no como constante de módulo): la app queda abierta
 * días entre envíos y la fecha va en el encabezado de una carta formal.
 */
function fechaHoy(): string {
  return new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

function varsDeudor(deudor: Partial<Deudor> | undefined, conjunto: string): Record<string, string> {
  return {
    nombre: deudor?.nombre ?? conjunto,
    cedula: deudor?.cedula ?? "",
    ubicacion: deudor?.ubicacion ?? "",
    direccion: deudor?.direccion ?? "",
    tipificacion: deudor?.tipificacion ?? "",
    conjunto,
    fecha: fechaHoy(),
  };
}

/**
 * Solo para la vista previa. El correo que sale de verdad lo renderiza el
 * backend (`functions/src/email/renderEmail.ts`) a partir de la plantilla y de
 * estos mismos valores; si cambias uno, cambia el otro.
 */
function replaceVariables(text: string, deudor: Partial<Deudor> | undefined, conjunto: string): string {
  const values = varsDeudor(deudor, conjunto);
  return EMAIL_VARIABLES.reduce(
    (result, variable) => result.replace(new RegExp(`\\{\\{${variable}\\}\\}`, "g"), () => values[variable] ?? ""),
    text
  );
}

/**
 * El correo del conjunto admite varias direcciones: la administración, el
 * consejo y el revisor suelen querer copia. Se acepta lo que la gente pega de
 * verdad (comas, puntos y coma o saltos de línea) y se deduplica.
 */
function parseEmailList(raw: string): { valid: string[]; invalid: string[] } {
  const parts = raw.split(/[,;\s]+/).map((part) => part.trim().toLowerCase()).filter(Boolean);
  const valid = [...new Set(parts.filter((part) => EMAIL_RE.test(part)))];
  const invalid = [...new Set(parts.filter((part) => !EMAIL_RE.test(part)))];
  return { valid, invalid };
}

/** Deudores que sí van en el cuadro anexo, ordenados por inmueble. */
function deudoresParaExcel(deudores: Deudor[]): Deudor[] {
  return deudores
    .filter((deudor) => !TIPIFICACIONES_FUERA_DE_GESTION.has(deudor.tipificacion))
    .slice()
    .sort((a, b) => (a.ubicacion ?? "").localeCompare(b.ubicacion ?? "", "es", { numeric: true }));
}

function buildDeudoresExcelBase64(deudores: Deudor[], conjunto: string): { filename: string; contentBase64: string; contentType: string } {
  const rows = deudores.map((deudor) => ({
    INMUEBLE: deudor.ubicacion ?? "",
    DEUDOR: deudor.nombre ?? "",
    "TIPIFICACIÓN": deudor.tipificacion ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 24 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Deudores");
  const contentBase64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
  const safeConjunto = conjunto.trim().replace(/[^\w\-]+/g, "_").slice(0, 60) || "conjunto";
  return {
    filename: `Deudores_${safeConjunto}.xlsx`,
    contentBase64,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

/** Imagen que se pinta dentro del cuerpo del correo (no como archivo adjunto). */
interface InlineImagePayload {
  filename: string;
  contentBase64: string;
  contentType: string;
}

/**
 * Techo de la imagen incrustada, espejo del que valida `sendEmailCampaign`.
 * Se comprueba aquí también para poder avisar antes del envío: si solo lo
 * validara el backend, el usuario lo descubriría al final, con todo redactado.
 */
const MAX_INLINE_IMAGE_BASE64 = 400_000;
/**
 * Marcador que indica dónde va la imagen dentro del cuerpo. Debe coincidir con
 * `IMAGE_PLACEHOLDER` de `functions/src/email/renderEmail.ts`: allá es donde se
 * sustituye de verdad, aquí solo se inserta y se previsualiza.
 */
const IMAGE_PLACEHOLDER = "{{imagen}}";
/** Ancho al que se reduce la imagen. 1000 px basta para verse bien en correo. */
const MAX_IMAGE_WIDTH = 1000;
const INLINE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // El dataURL viene como "data:<tipo>;base64,<contenido>": al backend solo
    // le sirve el contenido.
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Reduce la imagen antes de mandarla.
 *
 * Los adjuntos viajan en base64 DENTRO del documento de la campaña, y un
 * documento de Firestore tope en 1 MB: una foto de celular sin reducir no cabe.
 * Se exporta a JPEG sobre fondo blanco porque es lo que mejor comprime y todo
 * cliente de correo lo pinta; el GIF se manda intacto para no perder la
 * animación al aplanarlo en el canvas.
 */
async function prepareInlineImage(file: File): Promise<InlineImagePayload> {
  if (!INLINE_IMAGE_TYPES.includes(file.type)) {
    throw new Error("La imagen debe ser PNG, JPG, GIF o WEBP.");
  }

  if (file.type === "image/gif") {
    const contentBase64 = await blobToBase64(file);
    if (contentBase64.length > MAX_INLINE_IMAGE_BASE64) {
      throw new Error("El GIF es demasiado pesado. Usa uno más liviano o una imagen fija.");
    }
    return { filename: file.name, contentBase64, contentType: file.type };
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("El archivo no es una imagen válida."));
      element.src = url;
    });

    const scale = Math.min(1, MAX_IMAGE_WIDTH / image.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo procesar la imagen.");
    // Sin el relleno, una PNG con transparencia sale con fondo negro en JPEG.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.75)
    );
    if (!blob) throw new Error("No se pudo procesar la imagen.");

    const contentBase64 = await blobToBase64(blob);
    if (contentBase64.length > MAX_INLINE_IMAGE_BASE64) {
      throw new Error("La imagen sigue siendo muy pesada después de reducirla. Usa una más pequeña.");
    }

    const filename = file.name.replace(/\.[^.]+$/, "") || "imagen";
    return { filename: `${filename}.jpg`, contentBase64, contentType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Replica el marcado mínimo que interpreta `buildHtml` en el backend
 * (`functions/src/email/renderEmail.ts`): `**texto**` para negrilla y una
 * línea que empiece con `## ` como título destacado. Si eso cambia, hay que
 * actualizar esto también.
 */
function renderFormattedLines(text: string) {
  return text.split("\n").map((line, i) => {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      return (
        <div key={i} className="mt-3 mb-1 text-[15px] font-bold" style={{ color: "#004B87" }}>
          {headingMatch[1]}
        </div>
      );
    }
    if (line.trim() === "") {
      return <div key={i} className="min-h-[1em]" />;
    }
    const segments = line.split(/(\*\*.+?\*\*)/g).filter((seg) => seg !== "");
    return (
      <div key={i}>
        {segments.map((seg, j) =>
          seg.startsWith("**") && seg.endsWith("**") ? (
            <strong key={j}>{seg.slice(2, -2)}</strong>
          ) : (
            <span key={j}>{seg}</span>
          )
        )}
      </div>
    );
  });
}

/**
 * Cuerpo de la vista previa. Replica lo que hace `buildHtml` en el backend: la
 * imagen sustituye al marcador, y si no hay marcador se pinta al final. Si el
 * render del correo cambia allá, hay que actualizar esto también.
 */
function PreviewBody({ text, imageSrc }: { text: string; imageSrc: string | null }) {
  const parts = text.split(IMAGE_PLACEHOLDER);
  const imagen = imageSrc ? (
    <img src={imageSrc} alt="" className="my-3 block max-w-full rounded" />
  ) : null;

  return (
    <div className="text-gray-600 leading-relaxed">
      {parts.map((part, index) => (
        <span key={index}>
          {renderFormattedLines(part)}
          {index < parts.length - 1 && imagen}
        </span>
      ))}
      {parts.length === 1 && imagen}
    </div>
  );
}

export default function EmailComposePage() {
  const { clienteId, deudorId } = useParams<{ clienteId: string; deudorId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { can, loading: aclLoading } = useAcl();
  // El destino se elige en la pantalla. El parámetro `?destino=conjunto` se
  // sigue respetando solo como valor inicial, para no romper enlaces viejos.
  const isIndividual = !!deudorId;
  const [destino, setDestino] = useState<Destino>(
    searchParams.get("destino") === "conjunto" ? "conjunto" : "deudores"
  );
  const isConjunto = !isIndividual && destino === "conjunto";
  const isBulk = !isIndividual && destino === "deudores";
  const [conjunto, setConjunto] = useState("");
  const [deudores, setDeudores] = useState<Deudor[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateId, setTemplateId] = useState(EMAIL_TEMPLATES[0].id);
  const [subject, setSubject] = useState(EMAIL_TEMPLATES[0].subject);
  const [body, setBody] = useState(EMAIL_TEMPLATES[0].body);
  const [selectedTips, setSelectedTips] = useState<string[]>([]);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [conjuntoEmail, setConjuntoEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [history, setHistory] = useState<CampaignHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inlineImage, setInlineImage] = useState<InlineImagePayload | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  /** dataURL para la vista previa; se arma del mismo base64 que se envía. */
  const inlineImageSrc = inlineImage
    ? `data:${inlineImage.contentType};base64,${inlineImage.contentBase64}`
    : null;

  async function cargarImagen(file: File | undefined | null) {
    if (!file) return;
    setImageBusy(true);
    try {
      const prepared = await prepareInlineImage(file);
      setInlineImage(prepared);
      // Si el cuerpo aún no dice dónde va, se inserta el marcador al final para
      // que el usuario vea de inmediato que la imagen quedó en el correo.
      setBody((current) => (current.includes(IMAGE_PLACEHOLDER) ? current : `${current}\n\n${IMAGE_PLACEHOLDER}`));
      toast.success("Imagen lista para incrustarse en el correo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo procesar la imagen.");
    } finally {
      setImageBusy(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  /** Pegar con Ctrl+V una captura, sin tener que guardarla como archivo antes. */
  function handlePasteImagen(event: ClipboardEvent) {
    const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) =>
      item.type.startsWith("image/")
    );
    if (!imageItem) return;
    event.preventDefault();
    cargarImagen(imageItem.getAsFile());
  }

  /** Inserta {{imagen}} en la posición del cursor dentro del contenido. */
  function insertarMarcador() {
    const textarea = bodyRef.current;
    const at = textarea ? textarea.selectionStart : body.length;
    setBody((current) => `${current.slice(0, at)}${IMAGE_PLACEHOLDER}${current.slice(at)}`);
    // El cursor queda después del marcador recién insertado.
    requestAnimationFrame(() => {
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(at + IMAGE_PLACEHOLDER.length, at + IMAGE_PLACEHOLDER.length);
    });
  }

  useEffect(() => () => unsubscribeRef.current?.(), []);

  /** Historial de campañas de ESTE conjunto. Se recarga al terminar un envío. */
  const loadHistory = useCallback(() => {
    if (!clienteId) return;
    const fetchHistory = httpsCallable<{ clienteId: string }, { campaigns: CampaignHistoryItem[] }>(
      functions,
      "getEmailCampaignHistory"
    );
    setHistoryLoading(true);
    fetchHistory({ clienteId })
      .then((response) => setHistory(response.data.campaigns ?? []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [clienteId]);

  // Se depende del booleano, no de `can`: así el efecto no se vuelve a disparar
  // aunque el hook devuelva una función nueva en algún render.
  const puedeEnviarCorreos = can(PERMS.Email_Write);
  useEffect(() => {
    if (aclLoading || !puedeEnviarCorreos) return;
    loadHistory();
  }, [loadHistory, aclLoading, puedeEnviarCorreos]);

  useEffect(() => {
    if (!clienteId) return;
    setLoading(true);
    Promise.all([
      getClienteById(clienteId),
      deudorId ? getDeudorById(clienteId, deudorId).then((item) => item ? [item] : []) : obtenerDeudorPorCliente(clienteId),
      getUsuarioByUid(clienteId).catch(() => null),
    ]).then(([cliente, debtors, clienteUsuario]) => {
      setConjunto(cliente?.nombre ?? "");
      setConjuntoEmail(clienteUsuario?.email ?? "");
      setDeudores(debtors);
      if (deudorId) setSelectedEmail((debtors[0]?.correos ?? []).find((email) => EMAIL_RE.test(email)) ?? "");
    }).catch(() => toast.error("No fue posible cargar la información del conjunto."))
      .finally(() => setLoading(false));
  }, [clienteId, deudorId]);

  const tips = useMemo(() => [...new Set(deudores.map((d) => d.tipificacion).filter(Boolean))].sort(), [deudores]);
  const targetDeudores = isBulk
    ? deudores.filter((d) => selectedTips.includes(d.tipificacion))
    : deudores;
  const validRecipientCount = targetDeudores.reduce(
    (total, d) => total + (d.correos ?? []).filter((email) => EMAIL_RE.test(email.trim())).length,
    0
  );
  const previewDebtor = targetDeudores[0] ?? deudores[0];
  const selectedTemplate = EMAIL_TEMPLATES.find((item) => item.id === templateId);
  const conjuntoEmails = useMemo(() => parseEmailList(conjuntoEmail), [conjuntoEmail]);
  const excelDeudores = useMemo(() => deudoresParaExcel(deudores), [deudores]);
  const willAttachDeudoresExcel = isConjunto && !!selectedTemplate?.attachDeudoresExcel && excelDeudores.length > 0;
  const excelExcluidos = deudores.length - excelDeudores.length;

  function selectTemplate(id: string) {
    const template = EMAIL_TEMPLATES.find((item) => item.id === id);
    if (!template) return;
    setTemplateId(id);
    setSubject(template.subject);
    // Cambiar de plantilla reemplaza el cuerpo y con él el marcador. Si ya hay
    // una imagen cargada se vuelve a poner, o quedaría cargada pero sin salir
    // en el correo.
    setBody(inlineImage ? `${template.body}\n\n${IMAGE_PLACEHOLDER}` : template.body);
  }

  /** Suscribe la UI al avance de la campaña ya encolada. */
  function watchCampaign(campaignId: string, total: number) {
    unsubscribeRef.current?.();
    setProgress({ status: "queued", total, processed: 0, sent: 0, failed: 0 });
    unsubscribeRef.current = onSnapshot(
      doc(db, "emailCampaigns", campaignId),
      (snap) => {
        const data = snap.data();
        if (!data) return;
        const current: CampaignProgress = {
          status: String(data.status ?? "queued"),
          total: Number(data.total ?? total),
          processed: Number(data.processed ?? 0),
          sent: Number(data.sent ?? 0),
          failed: Number(data.failed ?? 0),
          results: data.results as SendResult[] | undefined,
        };
        setProgress(current);
        if (current.status === "done") {
          setSending(false);
          unsubscribeRef.current?.();
          unsubscribeRef.current = null;
          if (current.failed) toast.warning(`Enviados: ${current.sent}. Fallidos: ${current.failed}.`);
          else toast.success(`${current.sent} correo${current.sent === 1 ? "" : "s"} enviado${current.sent === 1 ? "" : "s"}.`);
          loadHistory();
        }
      },
      () => {
        setSending(false);
        toast.error("Se perdió el seguimiento del envío. Revisa el historial más abajo antes de reintentar.");
      }
    );
  }

  async function handleSend() {
    if (!clienteId || sending) return;

    const attachments = willAttachDeudoresExcel
      ? [buildDeudoresExcelBase64(excelDeudores, conjunto)]
      : undefined;

    const recipients = isConjunto
      ? conjuntoEmails.valid.map((to) => ({
          to,
          deudorId: "",
          deudorNombre: conjunto,
          tipificacion: "",
          vars: varsDeudor(undefined, conjunto),
        }))
      : (isBulk ? targetDeudores : deudores).flatMap((deudor) => {
          const emails = isBulk
            ? [...new Set((deudor.correos ?? []).map((email) => email.trim().toLowerCase()).filter((email) => EMAIL_RE.test(email)))]
            : [selectedEmail].filter((email) => EMAIL_RE.test(email));
          return emails.map((to) => ({
            to,
            deudorId: deudor.id,
            deudorNombre: deudor.nombre,
            tipificacion: deudor.tipificacion,
            vars: varsDeudor(deudor, conjunto),
          }));
        });

    if (recipients.length === 0) return toast.error("No hay correos válidos entre los destinatarios seleccionados.");
    if (recipients.length > 200) return toast.error("El envío supera el máximo de 200 correos por campaña.");

    // Un envío de cobranza no se puede deshacer: se confirma antes de disparar.
    const destinos = isConjunto
      ? `a ${recipients.map((recipient) => recipient.to).join(", ")}`
      : `a ${recipients.length} correo${recipients.length === 1 ? "" : "s"} de ${conjunto || "este conjunto"}`;
    const anexo = attachments ? `\n\nSe adjuntará "${attachments[0].filename}" con ${excelDeudores.length} deudores.` : "";
    const avisoImagen = inlineImage ? `\n\nEl correo lleva la imagen "${inlineImage.filename}" incrustada en el cuerpo.` : "";
    // Se muestra el asunto ya resuelto, no la plantilla con {{variables}}.
    const asuntoReal = replaceVariables(subject, isConjunto ? undefined : previewDebtor, conjunto);
    if (!window.confirm(`Vas a enviar "${asuntoReal}" ${destinos}.${anexo}${avisoImagen}\n\nEsta acción no se puede deshacer. ¿Continuar?`)) return;

    setSending(true);
    setProgress(null);
    try {
      const send = httpsCallable<{
        recipients: typeof recipients;
        attachments?: ReturnType<typeof buildDeudoresExcelBase64>[];
        inlineImage?: InlineImagePayload;
        mode: "bulk" | "individual" | "conjunto";
        templateId: string;
        clienteId: string;
        conjunto: string;
        subjectTemplate: string;
        bodyTemplate: string;
      }, { ok: boolean; campaignId: string; total: number }>(functions, "sendEmailCampaign");

      const response = await send({
        recipients,
        attachments,
        inlineImage: inlineImage ?? undefined,
        mode: isConjunto ? "conjunto" : isBulk ? "bulk" : "individual",
        templateId,
        clienteId,
        conjunto,
        subjectTemplate: subject,
        bodyTemplate: body,
      });

      // La función solo encola; el envío corre en background y lo seguimos aquí.
      watchCampaign(response.data.campaignId, response.data.total);
    } catch (error) {
      setSending(false);
      toast.error(error instanceof Error ? error.message : "No fue posible encolar los correos.");
    }
  }

  if (aclLoading || loading) return <div className="p-10 text-center text-sm text-gray-500">Cargando módulo de correos...</div>;
  if (!puedeEnviarCorreos) return <div className="p-10 text-center">No tienes permiso para enviar correos.</div>;

  const results = progress?.status === "done" ? progress.results : undefined;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ArrowLeft className="h-5 w-5" /></button>
        <div>
          <Typography variant="h2" className="!text-brand-secondary">{isConjunto ? "Enviar correo al conjunto" : isBulk ? "Envío masivo de correo" : "Enviar correo al deudor"}</Typography>
          <p className="text-sm text-gray-500">{conjunto}{!isBulk && previewDebtor ? ` · ${previewDebtor.nombre}` : ""}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 rounded-2xl border bg-white shadow-sm p-5 space-y-5">
          {!isIndividual && (
            <div className="space-y-2">
              <Label>Destinatario</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "deudores" as Destino, titulo: "A los deudores", detalle: "Uno por deudor, filtrado por tipificación" },
                  { value: "conjunto" as Destino, titulo: "Al conjunto", detalle: "Un solo correo a la administración" },
                ]).map((opcion) => (
                  <button
                    key={opcion.value}
                    type="button"
                    disabled={sending}
                    onClick={() => setDestino(opcion.value)}
                    className={`rounded-lg border p-3 text-left transition-colors disabled:opacity-60 ${
                      destino === opcion.value
                        ? "border-brand-primary bg-brand-primary/5"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <span className={`block text-sm font-semibold ${destino === opcion.value ? "text-brand-primary" : "text-gray-700"}`}>
                      {opcion.titulo}
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5">{opcion.detalle}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Plantilla</Label>
            <select value={templateId} onChange={(event) => selectTemplate(event.target.value)} className="w-full h-10 rounded-md border px-3 text-sm">
              {EMAIL_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </div>

          {isConjunto ? (
            <div className="space-y-2">
              <Label>Correo del conjunto</Label>
              <Input type="text" inputMode="email" value={conjuntoEmail} onChange={(event) => setConjuntoEmail(event.target.value)} placeholder="administracion@conjunto.com, consejo@conjunto.com" />
              <p className="text-xs text-gray-500">
                Se usa el correo de contacto registrado; puedes corregirlo para este envío. Puedes poner varios separados por coma o punto y coma.
              </p>
              {conjuntoEmails.valid.length > 1 && (
                <p className="text-xs text-gray-500">Se enviará un correo a cada una de las {conjuntoEmails.valid.length} direcciones, con el mismo contenido y anexo.</p>
              )}
              {conjuntoEmails.invalid.length > 0 && (
                <p className="text-xs text-amber-600">No se enviará a {conjuntoEmails.invalid.join(", ")}: no {conjuntoEmails.invalid.length === 1 ? "es un correo válido" : "son correos válidos"}.</p>
              )}
              {willAttachDeudoresExcel && (
                <p className="text-xs text-brand-primary">
                  Se adjuntará el Excel con {excelDeudores.length} deudores en gestión de {conjunto || "este conjunto"} (INMUEBLE / DEUDOR / TIPIFICACIÓN)
                  {excelExcluidos > 0 && `; se excluyeron ${excelExcluidos} por estar terminados, inactivos o devueltos`}.
                </p>
              )}
              {isConjunto && !!selectedTemplate?.attachDeudoresExcel && excelDeudores.length === 0 && (
                <p className="text-xs text-amber-600">No hay deudores en gestión para anexar; el correo saldrá sin el cuadro.</p>
              )}
            </div>
          ) : isBulk ? (
            <div className="space-y-2">
              <Label>Destinatarios por tipificación</Label>
              <div className="flex flex-wrap gap-2">
                {tips.map((tip) => (
                  <button key={tip} type="button" onClick={() => setSelectedTips((current) => current.includes(tip) ? current.filter((item) => item !== tip) : [...current, tip])} className={`rounded-full border px-3 py-1.5 text-xs ${selectedTips.includes(tip) ? "bg-brand-primary text-white" : "bg-white text-gray-600"}`}>{tip}</button>
                ))}
              </div>
              <p className="text-xs text-gray-500">{targetDeudores.length} deudores seleccionados · {validRecipientCount} correos válidos</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Correo destino</Label>
              {(previewDebtor?.correos ?? []).filter((email) => EMAIL_RE.test(email)).map((email) => (
                <label key={email} className="flex items-center gap-2 text-sm"><input type="radio" checked={selectedEmail === email} onChange={() => setSelectedEmail(email)} />{email}</label>
              ))}
              {!selectedEmail && <p className="text-xs text-amber-600">El deudor no tiene un correo válido registrado.</p>}
            </div>
          )}

          <div className="space-y-2"><Label>Asunto</Label><Input value={subject} onChange={(event) => setSubject(event.target.value)} /></div>
          <div className="space-y-2" onPaste={handlePasteImagen}>
            <Label>Contenido</Label>
            <Textarea ref={bodyRef} value={body} onChange={(event) => setBody(event.target.value)} rows={12} />
          </div>
          <p className="text-xs text-gray-500">Variables disponibles: {EMAIL_VARIABLES.map((variable) => `{{${variable}}}`).join(", ")}</p>
          <p className="text-xs text-gray-500">
            Formato: escribe <code className="rounded bg-gray-100 px-1">**texto**</code> para negrilla y una línea que empiece con{" "}
            <code className="rounded bg-gray-100 px-1">## </code> para un título destacado.
          </p>

          {/* Imagen incrustada en el cuerpo (no va como archivo adjunto) */}
          <div className="space-y-2 rounded-xl border p-3" onPaste={handlePasteImagen}>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm">Imagen en el cuerpo (opcional)</Label>
              {inlineImage && (
                <button type="button" onClick={insertarMarcador} className="text-xs text-brand-primary hover:underline">
                  Insertar {IMAGE_PLACEHOLDER} aquí
                </button>
              )}
            </div>

            {inlineImageSrc ? (
              <div className="flex items-start gap-3">
                <img src={inlineImageSrc} alt="Imagen del correo" className="h-20 w-20 rounded border object-cover" />
                <div className="min-w-0 flex-1 text-xs text-gray-500">
                  <p className="truncate font-medium text-gray-700">{inlineImage?.filename}</p>
                  <p>{Math.round((inlineImage?.contentBase64.length ?? 0) * 0.75 / 1024)} KB · se verá dentro del correo</p>
                  <button
                    type="button"
                    onClick={() => { setInlineImage(null); setBody((current) => current.split(IMAGE_PLACEHOLDER).join("").trimEnd()); }}
                    className="mt-1 text-red-500 hover:underline"
                  >
                    Quitar imagen
                  </button>
                </div>
              </div>
            ) : (
              <Input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                disabled={imageBusy || sending}
                onChange={(event) => cargarImagen(event.target.files?.[0])}
              />
            )}

            <p className="text-xs text-gray-500">
              {imageBusy
                ? "Procesando la imagen..."
                : `Se incrusta donde escribas ${IMAGE_PLACEHOLDER}; si no está, va al final. También puedes pegarla con Ctrl+V. Se reduce automáticamente antes de enviarla.`}
            </p>
          </div>
          <Button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim() || (isConjunto ? conjuntoEmails.valid.length === 0 || conjuntoEmails.invalid.length > 0 : isBulk ? validRecipientCount === 0 : !selectedEmail)} className="w-full gap-2">
            <Send className="h-4 w-4" />{sending ? "Enviando correos..." : isConjunto ? (conjuntoEmails.valid.length > 1 ? `Enviar al conjunto (${conjuntoEmails.valid.length} correos)` : "Enviar al conjunto") : isBulk ? `Enviar ${validRecipientCount} correos` : "Enviar correo"}
          </Button>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center gap-2"><Mail className="h-4 w-4 text-brand-primary" /><span className="text-sm font-semibold">Vista previa</span></div>
            <div className="p-5 text-sm">
              <p className="font-semibold mb-4">{replaceVariables(subject, previewDebtor, conjunto)}</p>
              <PreviewBody text={replaceVariables(body, previewDebtor, conjunto)} imageSrc={inlineImageSrc} />
            </div>
          </div>

          {progress && progress.status !== "done" && (
            <div className="rounded-2xl border bg-white p-4 space-y-2">
              <p className="font-semibold text-sm">
                {progress.status === "queued" ? "Envío encolado..." : `Enviando ${progress.processed} de ${progress.total}`}
              </p>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-brand-primary transition-all"
                  style={{ width: `${progress.total ? Math.round((progress.processed / progress.total) * 100) : 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">
                Puedes cerrar esta pantalla: el envío continúa y el resultado queda en el historial de abajo.
              </p>
            </div>
          )}

          {results && (
            <div className="rounded-2xl border bg-white p-4 space-y-2">
              <p className="font-semibold text-sm">Resultado del envío</p>
              {results.map((result, index) => (
                <div key={`${result.to}-${index}`} className="flex items-start gap-2 text-xs">
                  {result.status === "ok" ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> : <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                  <span>{result.deudorNombre} · {result.to}{result.error ? `: ${result.error}` : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Historial de envíos de este conjunto</h2>
          <p className="text-xs text-gray-500 mt-1">
            Fecha, contenido y resultado de las campañas enviadas a {conjunto || "este conjunto"} y a sus deudores.
          </p>
        </div>

        {historyLoading && <p className="text-sm text-gray-500">Cargando historial...</p>}
        {!historyLoading && history.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
            Aún no hay campañas de correo para este conjunto.
          </div>
        )}

        {history.map((campaign) => (
          <div key={campaign.id} className="rounded-lg border bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedId((current) => current === campaign.id ? null : campaign.id)}
              className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{campaign.subject || "Sin asunto"}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {campaign.mode === "bulk" ? "A deudores" : campaign.mode === "conjunto" ? "Al conjunto" : "Individual"}
                    {campaign.status && campaign.status !== "done" && ` · ${campaign.status === "sending" ? "enviando" : "en cola"}`}
                  </p>
                </div>
                <p className="text-xs text-gray-500 whitespace-nowrap">
                  {campaign.createdAtMs ? new Date(campaign.createdAtMs).toLocaleString("es-CO") : "Procesando"}
                </p>
              </div>
              <div className="flex gap-3 mt-2 text-xs">
                <span className="text-green-700">Enviados: {campaign.sent}</span>
                <span className={campaign.failed ? "text-red-700" : "text-gray-500"}>Fallidos: {campaign.failed}</span>
                <span className="text-gray-500">Total: {campaign.total}</span>
              </div>
            </button>
            {expandedId === campaign.id && (
              <div className="border-t bg-gray-50/60 px-4 py-4">
                <p className="text-xs font-semibold mb-2">Contenido enviado</p>
                <div className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {campaign.body || "El contenido no está disponible para este envío anterior."}
                </div>
                {campaign.attachmentNames?.length > 0 && (
                  <p className="text-xs text-gray-500 mt-3">Adjuntos: {campaign.attachmentNames.join(", ")}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
