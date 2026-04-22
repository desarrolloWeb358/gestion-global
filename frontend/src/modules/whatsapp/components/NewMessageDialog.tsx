import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import { toast } from "sonner";
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

export function NewMessageDialog({ open, onClose, numberId }: Props) {
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [phone, setPhone] = useState("");
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
    selectedTemplate.variables.every((v) => varValues[v.name]?.trim());

  const canSend = phone.trim().length >= 10 && selectedId && allVarsFilled;

  const handleSend = useCallback(async () => {
    if (!canSend || sending) return;
    setSending(true);
    try {
      const parameters = selectedTemplate
        ? selectedTemplate.variables.map((v) => ({
            parameterName: v.name,
            value: varValues[v.name]?.trim() ?? "",
          }))
        : [];

      const fn = httpsCallable<unknown, { ok: boolean; conversationId: string }>(
        functions,
        "sendMetaTemplate"
      );
      const result = await fn({
        numberId,
        to: phone.trim(),
        templateId: selectedId,
        parameters,
      });

      toast.success("Mensaje enviado correctamente");
      onClose();
      navigate(`/whatsapp/${numberId}/${result.data.conversationId}`);
    } catch (err: unknown) {
      console.error(err);
      const msg =
        err instanceof Error ? err.message : "No se pudo enviar el mensaje";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }, [canSend, sending, selectedTemplate, varValues, phone, numberId, selectedId, onClose, navigate]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md flex flex-col max-h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Nuevo mensaje</DialogTitle>
        </DialogHeader>

        {/* Área scrollable */}
        <div className="flex-1 overflow-y-auto space-y-4 py-1 pr-1">

          {/* Teléfono */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">Número de teléfono</Label>
            <Input
              id="phone"
              placeholder="573001234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Formato internacional sin espacios · Ej: 573001234567
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

          {/* Preview de la plantilla seleccionada */}
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

          {/* Campos de variables */}
          {selectedTemplate && selectedTemplate.variables.length > 0 && (
            <div className="space-y-3 rounded-md bg-muted/40 border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <IconVariable className="w-3.5 h-3.5" />
                Completa las variables
              </p>
              {selectedTemplate.variables.map((v) => (
                <div key={v.name} className="space-y-1">
                  <Label htmlFor={`var-${v.name}`} className="text-xs">
                    <span className="font-mono text-[#004B87]">{`{{${v.name}}}`}</span>
                  </Label>
                  <Input
                    id={`var-${v.name}`}
                    placeholder={`Valor para ${v.name}`}
                    value={varValues[v.name] ?? ""}
                    onChange={(e) =>
                      setVarValues((prev) => ({
                        ...prev,
                        [v.name]: e.target.value,
                      }))
                    }
                    className="h-8 text-sm"
                  />
                </div>
              ))}
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
            {sending ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
