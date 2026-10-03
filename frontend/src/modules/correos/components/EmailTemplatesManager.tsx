import { useCallback, useEffect, useState } from "react";
import { IconMail, IconPlus, IconEdit, IconTrash, IconVariable, IconFileSpreadsheet } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
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
import { DEFAULT_EMAIL_TEMPLATES, EMAIL_IMAGE_PLACEHOLDER, EMAIL_VARIABLES, unknownVariables, type EmailTemplate } from "../emailTemplates";
import {
  listenEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  seedDefaultEmailTemplates,
} from "../services/emailTemplatesService";

interface FormState {
  name: string;
  subject: string;
  body: string;
  attachDeudoresExcel: boolean;
}

const EMPTY_FORM: FormState = { name: "", subject: "", body: "", attachDeudoresExcel: false };

/** CRUD de las plantillas de correo. Vive en Ajustes > Plantillas de correo. */
export default function EmailTemplatesManager() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(
    () =>
      listenEmailTemplates(
        (data) => {
          setTemplates(data);
          setLoading(false);
        },
        () => {
          setLoading(false);
          toast.error("No se pudieron cargar las plantillas de correo.");
        }
      ),
    []
  );

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((template: EmailTemplate) => {
    setEditing(template);
    setForm({
      name: template.name,
      subject: template.subject,
      body: template.body,
      attachDeudoresExcel: !!template.attachDeudoresExcel,
    });
    setDialogOpen(true);
  }, []);

  const canSave = !!form.name.trim() && !!form.subject.trim() && !!form.body.trim();

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        subject: form.subject.trim(),
        body: form.body,
        attachDeudoresExcel: form.attachDeudoresExcel,
      };
      if (editing) await updateEmailTemplate(editing.id, payload);
      else await createEmailTemplate(payload);
      setDialogOpen(false);
      toast.success(editing ? "Plantilla actualizada." : "Plantilla creada.");
    } catch {
      toast.error("No se pudo guardar la plantilla.");
    } finally {
      setSaving(false);
    }
  }, [canSave, form, editing]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteEmailTemplate(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      toast.error("No se pudo eliminar la plantilla.");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget]);

  const handleSeed = useCallback(async () => {
    setSeeding(true);
    try {
      await seedDefaultEmailTemplates();
      toast.success("Plantillas cargadas.");
    } catch {
      toast.error("No se pudieron cargar las plantillas.");
    } finally {
      setSeeding(false);
    }
  }, []);

  const desconocidas = unknownVariables(`${form.subject}\n${form.body}`);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="gap-2">
          <IconPlus className="w-4 h-4" />
          Nueva plantilla
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Cargando plantillas...</p>}

      {!loading && templates.length === 0 && (
        <div className="border border-dashed border-border rounded-lg p-10 text-center">
          <IconMail className="w-8 h-8 text-muted-foreground opacity-30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No hay plantillas de correo guardadas.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Mientras tanto, la pantalla de envío usa las {DEFAULT_EMAIL_TEMPLATES.length} plantillas predeterminadas.
            Cárgalas aquí para poder editarlas.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={handleSeed} disabled={seeding} className="gap-2">
              {seeding ? "Cargando..." : `Cargar las ${DEFAULT_EMAIL_TEMPLATES.length} predeterminadas`}
            </Button>
            <Button onClick={openCreate} variant="outline" className="gap-2">
              <IconPlus className="w-4 h-4" />
              Crear desde cero
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {templates.map((template) => (
          <div key={template.id} className="border border-border rounded-lg p-4 bg-background flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-foreground">{template.name}</span>
                {template.attachDeudoresExcel && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <IconFileSpreadsheet className="w-3 h-3" />
                    Adjunta Excel de deudores
                  </Badge>
                )}
              </div>
              <p className="text-xs text-foreground/80 mt-1">Asunto: {template.subject}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">{template.body}</p>
              {unknownVariables(`${template.subject}\n${template.body}`).length > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Tiene variables que no existen: {unknownVariables(`${template.subject}\n${template.body}`).map((v) => `{{${v}}}`).join(", ")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(template)}>
                <IconEdit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(template)}
              >
                <IconTrash className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-1">
            <div className="space-y-1.5">
              <Label htmlFor="emailTplName">Nombre</Label>
              <Input
                id="emailTplName"
                placeholder="Ej: Jornada de normalización"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="emailTplSubject">Asunto</Label>
              <Input
                id="emailTplSubject"
                placeholder="Ej: Recordatorio de cartera - {{conjunto}}"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="emailTplBody">Cuerpo</Label>
              <Textarea
                id="emailTplBody"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={12}
              />
              <p className="text-xs text-muted-foreground">
                **texto** para negrilla; una línea que empiece con "## " sale como título.
                Escribe {`{{${EMAIL_IMAGE_PLACEHOLDER}}}`} donde quieras la imagen, si la lleva.
              </p>
            </div>

            <div className="rounded-md bg-muted/50 border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <IconVariable className="w-3 h-3" />
                Variables disponibles
              </p>
              <div className="flex flex-wrap gap-1">
                {EMAIL_VARIABLES.map((v) => (
                  <Badge key={v} variant="outline" className="font-mono text-xs">{`{{${v}}}`}</Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {"{{fecha}}"} es la fecha del día del envío. {"{{conjunto}}"} es el nombre del cliente.
              </p>
              {desconocidas.length > 0 && (
                <p className="text-xs text-amber-600 mt-2">
                  {desconocidas.map((v) => `{{${v}}}`).join(", ")} no {desconocidas.length === 1 ? "existe" : "existen"}: saldría tal cual en el correo.
                </p>
              )}
            </div>

            <div className="flex items-start gap-2.5 rounded-md border border-border p-3">
              <Checkbox
                id="emailTplExcel"
                checked={form.attachDeudoresExcel}
                onCheckedChange={(v) => setForm((f) => ({ ...f, attachDeudoresExcel: v === true }))}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label htmlFor="emailTplExcel" className="cursor-pointer">Adjuntar el Excel de deudores del conjunto</Label>
                <p className="text-xs text-muted-foreground">Solo aplica cuando el correo se envía "Al conjunto".</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear plantilla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <span className="font-medium">"{deleteTarget?.name}"</span>. Los correos ya enviados con ella no se afectan.
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
