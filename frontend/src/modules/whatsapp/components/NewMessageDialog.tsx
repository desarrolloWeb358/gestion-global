import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { collectionGroup, getDocs, limit, query, Timestamp, where } from "firebase/firestore";
import { functions, db } from "@/firebase";
import { toast } from "sonner";
import { useAuth } from "@/app/providers/AuthContext";
import { addSeguimiento, addSeguimientoJuridico } from "@/modules/cobranza/services/seguimientoService";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { IconSend, IconVariable } from "@tabler/icons-react";
import type { WaTemplate } from "../models/waTemplate.model";
import { listenTemplates } from "../services/templatesService";

interface Props {
  open: boolean;
  onClose: () => void;
  numberId: string;
}

// Misma lógica que el webhook: quita prefijo 57 si es colombiano
function toLocal(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("57")) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith("057")) return digits.slice(3);
  return digits;
}

// Agrega 57 solo si parece colombiano (10 dígitos comenzando con 3)
function toIntl(local: string): string {
  if (local.length === 10 && local.startsWith("3")) return `57${local}`;
  return local;
}

const TIPS_JURIDICO = new Set([
  TipificacionDeuda.DEMANDA,
  TipificacionDeuda.DEMANDA_ACUERDO,
  TipificacionDeuda.DEMANDA_TERMINADO,
  TipificacionDeuda.DEMANDA_INSOLVENCIA,
]);

// Misma query que el webhook: busca en collectionGroup "deudores" por teléfono
async function buscarDeudorPorTelefono(localPhone: string) {
  if (!localPhone) return null;
  try {
    const snap = await getDocs(
      query(
        collectionGroup(db, "deudores"),
        where("telefonos", "array-contains", localPhone),
        limit(1)
      )
    );
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const parts = doc.ref.path.split("/"); // clientes/{clienteId}/deudores/{deudorId}
    return {
      clienteId: parts[1],
      deudorId: parts[3],
      deudorNombre: (doc.data().nombre as string) ?? "",
      tipificacion: (doc.data().tipificacion as TipificacionDeuda) ?? null,
    };
  } catch {
    return null;
  }
}

export function NewMessageDialog({ open, onClose, numberId }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [phone, setPhone] = useState(""); // guardado en formato local (sin 57)
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const unsub = listenTemplates(numberId, setTemplates);
    return unsub;
  }, [open, numberId]);

  useEffect(() => {
    if (!open) {
      setSelectedId("");
      setPhone("");
      setVarValues({});
    }
  }, [open]);

  const selectedTemplate = templates.find((t) => t.id === selectedId) ?? null;

  const handleSelectTemplate = useCallback((id: string) => {
    setSelectedId(id);
    setVarValues({});
  }, []);

  const allVarsFilled =
    !selectedTemplate ||
    selectedTemplate.variables.every((v) => v.name === "telefono" || varValues[v.name]?.trim());

  const intlPhone = toIntl(phone);
  const canSend = phone.trim().length >= 7 && selectedId && allVarsFilled;

  const handleSend = useCallback(async () => {
    if (!canSend || sending) return;
    setSending(true);
    try {
      // Busca si hay un deudor con ese número (igual que el webhook)
      const deudorMeta = await buscarDeudorPorTelefono(phone.trim());

      const parameters = selectedTemplate
        ? selectedTemplate.variables.map((v) => ({
            parameterName: v.name,
            value: v.name === "telefono"
              ? intlPhone
              : (varValues[v.name]?.trim() ?? ""),
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
        ...(deudorMeta && {
          clienteId: deudorMeta.clienteId,
          deudorId: deudorMeta.deudorId,
          deudorNombre: deudorMeta.deudorNombre,
        }),
      });

      if (deudorMeta && user) {
        const esJuridico = deudorMeta.tipificacion !== null && TIPS_JURIDICO.has(deudorMeta.tipificacion);
        const saveFn = esJuridico ? addSeguimientoJuridico : addSeguimiento;
        const descripcion = selectedTemplate
          ? selectedTemplate.variables.reduce(
              (text, v) =>
                text.replace(
                  new RegExp(`\\{\\{${v.name}\\}\\}`, "g"),
                  v.name === "telefono" ? intlPhone : (varValues[v.name]?.trim() ?? "")
                ),
              selectedTemplate.bodyText
            )
          : selectedId;
        await saveFn(user.uid, deudorMeta.clienteId, deudorMeta.deudorId, {
          fecha: Timestamp.fromDate(new Date()),
          tipoSeguimiento: "whatsapp",
          descripcion: `Se envió el mensaje:\n${descripcion}\n\nNúmero: ${intlPhone}`,
        });
      }

      toast.success(
        deudorMeta
          ? `Mensaje enviado · Vinculado a ${deudorMeta.deudorNombre}`
          : "Mensaje enviado correctamente"
      );
      onClose();
      navigate(`/whatsapp/${numberId}/${result.data.conversationId}`);
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el mensaje");
    } finally {
      setSending(false);
    }
  }, [canSend, sending, selectedTemplate, varValues, phone, intlPhone, numberId, selectedId, onClose, navigate]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md flex flex-col max-h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Nuevo mensaje</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-1 pr-1">

          {/* Teléfono */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">Número de teléfono</Label>
            <Input
              id="phone"
              placeholder="3001234567"
              value={phone}
              onChange={(e) => setPhone(toLocal(e.target.value))}
              className="font-mono"
              inputMode="numeric"
            />
            <p className="text-xs text-muted-foreground">
              Escribe el número local · el prefijo +57 se agrega automáticamente para Colombia
              {phone.length >= 7 && (
                <span className="ml-1 text-brand-primary font-medium">
                  → {intlPhone}
                </span>
              )}
            </p>
          </div>

          {/* Selector de plantilla */}
          <div className="space-y-1.5">
            <Label>Plantilla</Label>
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-1">
                No hay plantillas registradas para este número.
              </p>
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
            <div className="rounded-md bg-muted/40 border border-border p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground font-mono">
                {selectedTemplate.providerTemplateName}
              </p>
              {selectedTemplate.bodyText && (
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {selectedTemplate.bodyText}
                </p>
              )}
            </div>
          )}

          {/* Variables */}
          {selectedTemplate && selectedTemplate.variables.length > 0 && (
            <div className="space-y-3 rounded-md bg-muted/40 border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <IconVariable className="w-3.5 h-3.5" />
                Completa las variables
              </p>
              {selectedTemplate.variables.map((v) => {
                const isPhone = v.name === "telefono";
                return (
                  <div key={v.name} className="space-y-1">
                    <Label htmlFor={`var-${v.name}`} className="text-xs">
                      <span className="font-mono text-[#004B87]">{`{{${v.name}}}`}</span>
                      {isPhone && (
                        <span className="ml-2 text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                          automático
                        </span>
                      )}
                    </Label>
                    <Input
                      id={`var-${v.name}`}
                      placeholder={isPhone ? undefined : `Valor para ${v.name}`}
                      value={isPhone ? intlPhone : (varValues[v.name] ?? "")}
                      readOnly={isPhone}
                      onChange={(e) =>
                        !isPhone &&
                        setVarValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                      }
                      className={`h-8 text-sm ${isPhone ? "bg-gray-50 text-gray-500 cursor-not-allowed font-mono" : ""}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 pt-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend || sending}
            className="gap-2 bg-[#004B87] hover:bg-[#003a6b]"
          >
            <IconSend className="w-4 h-4" />
            {sending ? "Buscando y enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
