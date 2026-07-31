import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { ArrowLeft, CheckCircle, Mail, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { functions } from "@/firebase";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Typography } from "@/shared/design-system/components/Typography";
import { getClienteById } from "@/modules/clientes/services/clienteService";
import { getDeudorById, obtenerDeudorPorCliente } from "@/modules/cobranza/services/deudorService";
import type { Deudor } from "@/modules/cobranza/models/deudores.model";
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

interface CampaignResponse {
  ok: boolean;
  sent: number;
  failed: number;
  results: SendResult[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[char] ?? char));
}

function replaceVariables(text: string, deudor: Partial<Deudor> | undefined, conjunto: string): string {
  const values: Record<string, string> = {
    nombre: deudor?.nombre ?? conjunto,
    cedula: deudor?.cedula ?? "",
    ubicacion: deudor?.ubicacion ?? "",
    direccion: deudor?.direccion ?? "",
    tipificacion: deudor?.tipificacion ?? "",
    conjunto,
  };
  return EMAIL_VARIABLES.reduce(
    (result, variable) => result.replace(new RegExp(`\\{\\{${variable}\\}\\}`, "g"), values[variable]),
    text
  );
}

function buildHtml(text: string): string {
  const paragraphs = escapeHtml(text)
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px;line-height:1.6">${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:Arial,sans-serif;color:#243447;max-width:680px;margin:auto"><div style="background:#004B87;color:white;padding:18px 24px;font-size:20px;font-weight:700">Gestión Global ACG</div><div style="padding:24px;border:1px solid #dde5ec">${paragraphs}</div></div>`;
}

export default function EmailComposePage() {
  const { clienteId, deudorId } = useParams<{ clienteId: string; deudorId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { can, loading: aclLoading } = useAcl();
  const isConjunto = !deudorId && searchParams.get("destino") === "conjunto";
  const isBulk = !deudorId && !isConjunto;
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
  const [results, setResults] = useState<SendResult[] | null>(null);

  useEffect(() => {
    if (!clienteId) return;
    setLoading(true);
    Promise.all([
      getClienteById(clienteId),
      deudorId ? getDeudorById(clienteId, deudorId).then((item) => item ? [item] : []) : obtenerDeudorPorCliente(clienteId),
      getUsuarioByUid(clienteId).catch(() => null),
    ]).then(([cliente, debtors, clienteUsuario]) => {
      setConjunto(cliente?.nombre ?? "");
      setConjuntoEmail(cliente?.correoContacto ?? clienteUsuario?.email ?? "");
      setDeudores(debtors);
      if (deudorId) setSelectedEmail((debtors[0]?.correos ?? []).find((email) => EMAIL_RE.test(email)) ?? "");
    }).finally(() => setLoading(false));
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

  function selectTemplate(id: string) {
    const template = EMAIL_TEMPLATES.find((item) => item.id === id);
    if (!template) return;
    setTemplateId(id);
    setSubject(template.subject);
    setBody(template.body);
  }

  async function handleSend() {
    if (!clienteId || sending) return;
    const selectedDebtors = isBulk ? targetDeudores : deudores;
    const items = isConjunto ? [{
      to: conjuntoEmail.trim().toLowerCase(),
      subject: replaceVariables(subject, undefined, conjunto),
      text: replaceVariables(body, undefined, conjunto),
      html: buildHtml(replaceVariables(body, undefined, conjunto)),
      clienteId,
      deudorId: "",
      deudorNombre: conjunto,
      tipificacion: "",
    }] : selectedDebtors.flatMap((deudor) => {
      const emails = isBulk
        ? [...new Set((deudor.correos ?? []).map((email) => email.trim().toLowerCase()).filter((email) => EMAIL_RE.test(email)))]
        : [selectedEmail].filter((email) => EMAIL_RE.test(email));
      const resolvedSubject = replaceVariables(subject, deudor, conjunto);
      const resolvedBody = replaceVariables(body, deudor, conjunto);
      return emails.map((to) => ({
        to,
        subject: resolvedSubject,
        text: resolvedBody,
        html: buildHtml(resolvedBody),
        clienteId,
        deudorId: deudor.id,
        deudorNombre: deudor.nombre,
        tipificacion: deudor.tipificacion,
      }));
    });
    if (items.length === 0) return toast.error("No hay correos válidos entre los destinatarios seleccionados.");
    if (items.length > 200) return toast.error("El envío supera el máximo de 200 correos por campaña.");
    setSending(true);
    setResults(null);
    try {
      const send = httpsCallable<{
        items: typeof items;
        mode: "bulk" | "individual" | "conjunto";
        templateId: string;
        clienteId: string;
        conjunto: string;
        subjectTemplate: string;
        bodyTemplate: string;
      }, CampaignResponse>(functions, "sendEmailCampaign");
      const response = await send({
        items,
        mode: isConjunto ? "conjunto" : isBulk ? "bulk" : "individual",
        templateId,
        clienteId,
        conjunto,
        subjectTemplate: subject,
        bodyTemplate: body,
      });
      setResults(response.data.results);
      if (response.data.failed) toast.warning(`Enviados: ${response.data.sent}. Fallidos: ${response.data.failed}.`);
      else toast.success(`${response.data.sent} correo${response.data.sent === 1 ? "" : "s"} enviado${response.data.sent === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible enviar los correos.");
    } finally {
      setSending(false);
    }
  }

  if (aclLoading || loading) return <div className="p-10 text-center text-sm text-gray-500">Cargando módulo de correos...</div>;
  if (!can(PERMS.Email_Write)) return <div className="p-10 text-center">No tienes permiso para enviar correos.</div>;

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
          <div className="space-y-2">
            <Label>Plantilla</Label>
            <select value={templateId} onChange={(event) => selectTemplate(event.target.value)} className="w-full h-10 rounded-md border px-3 text-sm">
              {EMAIL_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </div>

          {isConjunto ? (
            <div className="space-y-2">
              <Label>Correo del conjunto</Label>
              <Input type="email" value={conjuntoEmail} onChange={(event) => setConjuntoEmail(event.target.value)} placeholder="administracion@conjunto.com" />
              <p className="text-xs text-gray-500">Se usa el correo de contacto registrado; puedes corregirlo para este envío.</p>
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
          <div className="space-y-2"><Label>Contenido</Label><Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={12} /></div>
          <p className="text-xs text-gray-500">Variables disponibles: {EMAIL_VARIABLES.map((variable) => `{{${variable}}}`).join(", ")}</p>
          <Button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim() || (isConjunto ? !EMAIL_RE.test(conjuntoEmail.trim()) : isBulk ? validRecipientCount === 0 : !selectedEmail)} className="w-full gap-2">
            <Send className="h-4 w-4" />{sending ? "Enviando correos..." : isConjunto ? "Enviar al conjunto" : isBulk ? `Enviar ${validRecipientCount} correos` : "Enviar correo"}
          </Button>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center gap-2"><Mail className="h-4 w-4 text-brand-primary" /><span className="text-sm font-semibold">Vista previa</span></div>
            <div className="p-5 text-sm"><p className="font-semibold mb-4">{replaceVariables(subject, previewDebtor, conjunto)}</p><div className="whitespace-pre-wrap text-gray-600 leading-relaxed">{replaceVariables(body, previewDebtor, conjunto)}</div></div>
          </div>
          {results && <div className="rounded-2xl border bg-white p-4 space-y-2"><p className="font-semibold text-sm">Resultado del envío</p>{results.map((result, index) => <div key={`${result.to}-${index}`} className="flex items-start gap-2 text-xs">{result.status === "ok" ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> : <XCircle className="h-4 w-4 text-red-600 shrink-0" />}<span>{result.deudorNombre} · {result.to}{result.error ? `: ${result.error}` : ""}</span></div>)}</div>}
        </div>
      </div>
    </div>
  );
}
