import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  IconBrandWhatsapp,
  IconPlus,
  IconEdit,
  IconTrash,
  IconArrowLeft,
  IconVariable,
} from "@tabler/icons-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import type { WaTemplate, WaTemplateVariable } from "../models/waTemplate.model";
import {
  listenTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "../services/templatesService";

function extractVariables(text: string): WaTemplateVariable[] {
  const matches = text.match(/\{\{(\w+)\}\}/g) ?? [];
  const seen = new Set<string>();
  const vars: WaTemplateVariable[] = [];
  for (const m of matches) {
    const name = m.replace(/\{\{|\}\}/g, "");
    if (!seen.has(name)) {
      seen.add(name);
      vars.push({ name });
    }
  }
  return vars;
}

interface FormState {
  displayName: string;
  providerTemplateName: string;
  bodyText: string;
}

const EMPTY_FORM: FormState = {
  displayName: "",
  providerTemplateName: "",
  bodyText: "",
};

export default function TemplatesPage() {
  const { numberId } = useParams<{ numberId: string }>();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WaTemplate | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<WaTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!numberId) return;
    setLoading(true);
    const unsub = listenTemplates(numberId, (data) => {
      setTemplates(data);
      setLoading(false);
    });
    return unsub;
  }, [numberId]);

  const openCreate = useCallback(() => {
    setEditingTemplate(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((t: WaTemplate) => {
    setEditingTemplate(t);
    setForm({
      displayName: t.displayName,
      providerTemplateName: t.providerTemplateName,
      bodyText: t.bodyText,
    });
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!numberId) return;
    if (!form.displayName.trim() || !form.providerTemplateName.trim()) return;

    setSaving(true);
    try {
      const variables = extractVariables(form.bodyText);
      const payload = {
        displayName: form.displayName.trim(),
        providerTemplateName: form.providerTemplateName.trim(),
        bodyText: form.bodyText,
        variables,
      };

      if (editingTemplate) {
        await updateTemplate(numberId, editingTemplate.id, payload);
      } else {
        await createTemplate(numberId, payload);
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }, [numberId, form, editingTemplate]);

  const handleDelete = useCallback(async () => {
    if (!numberId || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTemplate(numberId, deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [numberId, deleteTarget]);

  const detectedVars = extractVariables(form.bodyText);

  if (!numberId) return null;

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/whatsapp/${numberId}`)}
          className="flex-shrink-0"
        >
          <IconArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <IconBrandWhatsapp className="w-5 h-5 text-green-600" />
            Plantillas de Mensajes
          </h1>
          <p className="text-sm text-muted-foreground">
            Plantillas aprobadas en Meta Business Suite
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <IconPlus className="w-4 h-4" />
          Nueva plantilla
        </Button>
      </div>

      {/* Lista */}
      {loading && (
        <p className="text-sm text-muted-foreground">Cargando plantillas...</p>
      )}

      {!loading && templates.length === 0 && (
        <div className="border border-dashed border-border rounded-lg p-10 text-center">
          <IconBrandWhatsapp className="w-8 h-8 text-muted-foreground opacity-30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No hay plantillas registradas.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Crea una plantilla que ya hayas aprobado en Meta Business Suite.
          </p>
          <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
            <IconPlus className="w-4 h-4" />
            Agregar plantilla
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {templates.map((t) => (
          <div
            key={t.id}
            className="border border-border rounded-lg p-4 bg-background flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-foreground">
                    {t.displayName}
                  </span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {t.providerTemplateName}
                  </Badge>
                </div>
                {t.bodyText && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {t.bodyText}
                  </p>
                )}
                {t.variables.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    <IconVariable className="w-3 h-3 text-muted-foreground" />
                    {t.variables.map((v) => (
                      <Badge key={v.name} variant="outline" className="text-xs py-0">
                        {`{{${v.name}}}`}
                      </Badge>
                    ))}
                  </div>
                )}
                {t.createdAt && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Creada el{" "}
                    {t.createdAt.toDate().toLocaleDateString("es-CO", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(t)}
                >
                  <IconEdit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(t)}
                >
                  <IconTrash className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dialog Crear/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Editar plantilla" : "Nueva plantilla"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Nombre para mostrar</Label>
              <Input
                id="displayName"
                placeholder="Ej: Bienvenida inicial"
                value={form.displayName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, displayName: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="providerTemplateName">
                Nombre exacto en Meta{" "}
                <span className="text-muted-foreground text-xs">(sin espacios)</span>
              </Label>
              <Input
                id="providerTemplateName"
                placeholder="Ej: bienvenida_inicial"
                value={form.providerTemplateName}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    providerTemplateName: e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, "_"),
                  }))
                }
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Debe coincidir exactamente con el nombre aprobado en Meta Business Suite.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bodyText">
                Cuerpo del mensaje{" "}
                <span className="text-muted-foreground text-xs">(referencia)</span>
              </Label>
              <Textarea
                id="bodyText"
                placeholder="Hola {{nombre}}, te recordamos que tienes una deuda de {{monto}}."
                value={form.bodyText}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bodyText: e.target.value }))
                }
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Usa {"{{"} {"variable"} {"}}"} para marcar campos dinámicos. Se detectan automáticamente.
              </p>
            </div>

            {detectedVars.length > 0 && (
              <div className="rounded-md bg-muted/50 border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <IconVariable className="w-3 h-3" />
                  Variables detectadas
                </p>
                <div className="flex flex-wrap gap-1">
                  {detectedVars.map((v) => (
                    <Badge key={v.name} variant="outline" className="font-mono text-xs">
                      {`{{${v.name}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                !form.displayName.trim() ||
                !form.providerTemplateName.trim()
              }
            >
              {saving ? "Guardando..." : editingTemplate ? "Guardar cambios" : "Crear plantilla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog Eliminar */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará{" "}
              <span className="font-medium">"{deleteTarget?.displayName}"</span>{" "}
              de Firestore. Esta acción no elimina la plantilla en Meta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
