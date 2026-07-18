import * as React from "react";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";
import { CalendarIcon, Trash2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/shared/ui/alert-dialog";

import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import type { Tarea, TareaPrioridad } from "../models/tarea.model";
import { TAREA_PRIORIDAD_BADGE_CLASS, TAREA_PRIORIDAD_LABELS } from "../constants/tareaConstants";
import { crearTarea, actualizarTarea, eliminarTarea } from "../services/tareaService";

interface TareaFormModalProps {
  tarea?: Tarea | null;
  canManage: boolean;
  ejecutivos: UsuarioSistema[];
  actor: { uid: string; nombre?: string };
  onClose: () => void;
  onSaved: () => void;
}

export function TareaFormModal({ tarea, canManage, ejecutivos, actor, onClose, onSaved }: TareaFormModalProps) {
  const esEdicion = !!tarea;
  const soloLectura = esEdicion && !canManage;

  const [titulo, setTitulo] = React.useState(tarea?.titulo ?? "");
  const [descripcion, setDescripcion] = React.useState(tarea?.descripcion ?? "");
  const [prioridad, setPrioridad] = React.useState<TareaPrioridad>(tarea?.prioridad ?? "media");
  const [asignadoA, setAsignadoA] = React.useState(tarea?.asignadoA ?? "");
  const [fechaLimite, setFechaLimite] = React.useState<Date | undefined>(
    tarea?.fechaLimite ? (tarea.fechaLimite as any).toDate() : undefined
  );
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  async function onSubmit() {
    if (!titulo.trim()) {
      toast.error("El título es obligatorio.");
      return;
    }
    if (!asignadoA) {
      toast.error("Selecciona un ejecutivo asignado.");
      return;
    }

    const ejecutivo = ejecutivos.find((e) => e.uid === asignadoA);
    setSaving(true);
    try {
      if (esEdicion && tarea?.id) {
        await actualizarTarea(tarea.id, {
          titulo,
          descripcion,
          prioridad,
          fechaLimite: fechaLimite ? Timestamp.fromDate(fechaLimite) : null,
          asignadoA,
          asignadoNombre: ejecutivo?.nombre ?? "",
        });
        toast.success("Tarea actualizada.");
      } else {
        await crearTarea(
          {
            titulo,
            descripcion,
            prioridad,
            fechaLimite: fechaLimite ? Timestamp.fromDate(fechaLimite) : null,
            asignadoA,
            asignadoNombre: ejecutivo?.nombre ?? "",
          },
          actor
        );
        toast.success("Tarea creada.");
      }
      onSaved();
    } catch (err) {
      console.error("[TareaFormModal] Error al guardar:", err);
      toast.error("No se pudo guardar la tarea.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!tarea?.id) return;
    setSaving(true);
    try {
      await eliminarTarea(tarea.id, tarea.titulo);
      toast.success("Tarea eliminada.");
      onSaved();
    } catch (err) {
      console.error("[TareaFormModal] Error al eliminar:", err);
      toast.error("No se pudo eliminar la tarea.");
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {soloLectura ? "Detalle de tarea" : esEdicion ? "Editar tarea" : "Nueva tarea"}
            </DialogTitle>
          </DialogHeader>

          <form className="space-y-4 py-2" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
            <div className="space-y-2">
              <Label>Título *</Label>
              {soloLectura ? (
                <p className="text-sm font-medium">{titulo}</p>
              ) : (
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={saving} placeholder="Título de la tarea" />
              )}
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              {soloLectura ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{descripcion || "—"}</p>
              ) : (
                <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} disabled={saving} placeholder="Detalles de la tarea" />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioridad</Label>
                {soloLectura ? (
                  <Badge variant="outline" className={TAREA_PRIORIDAD_BADGE_CLASS[prioridad]}>
                    {TAREA_PRIORIDAD_LABELS[prioridad]}
                  </Badge>
                ) : (
                  <Select value={prioridad} onValueChange={(v) => setPrioridad(v as TareaPrioridad)} disabled={saving}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TAREA_PRIORIDAD_LABELS) as TareaPrioridad[]).map((p) => (
                        <SelectItem key={p} value={p}>{TAREA_PRIORIDAD_LABELS[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label>Fecha límite</Label>
                {soloLectura ? (
                  <p className="text-sm">{fechaLimite ? fechaLimite.toLocaleDateString("es-CO") : "—"}</p>
                ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" disabled={saving} className="w-full justify-start font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fechaLimite ? fechaLimite.toLocaleDateString("es-CO") : "Sin definir"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fechaLimite}
                        defaultMonth={fechaLimite}
                        onSelect={(d) => setFechaLimite(d)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Asignado a *</Label>
              {soloLectura ? (
                <p className="text-sm font-medium">{tarea?.asignadoNombre || "—"}</p>
              ) : (
                <Select value={asignadoA} onValueChange={setAsignadoA} disabled={saving}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un ejecutivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {ejecutivos.map((e) => (
                      <SelectItem key={e.uid} value={e.uid}>{e.nombre || e.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {soloLectura ? (
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
              </DialogFooter>
            ) : (
              <DialogFooter className="flex items-center justify-between sm:justify-between">
                {esEdicion ? (
                  <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)} disabled={saving}>
                    <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                  </Button>
                ) : <span />}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>
                    {esEdicion ? "Guardar cambios" : "Crear tarea"}
                  </Button>
                </div>
              </DialogFooter>
            )}
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La tarea se eliminará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDelete(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
