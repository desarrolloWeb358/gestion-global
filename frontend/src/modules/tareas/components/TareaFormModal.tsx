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
import { Checkbox } from "@/shared/ui/checkbox";
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
import type { TareaSeguimiento } from "../models/tareaSeguimiento.model";
import { TAREA_PRIORIDAD_BADGE_CLASS, TAREA_PRIORIDAD_LABELS } from "../constants/tareaConstants";
import { crearTarea, actualizarTarea, eliminarTarea } from "../services/tareaService";
import { suscribirSeguimientosTarea, addSeguimientoTarea } from "../services/tareaSeguimientoService";

interface TareaFormModalProps {
  tarea?: Tarea | null;
  canManage: boolean;
  canAssign: boolean;
  usuariosAsignables: UsuarioSistema[];
  actor: { uid: string; nombre?: string };
  onClose: () => void;
  onSaved: () => void;
}

export function TareaFormModal({ tarea, canManage, canAssign, usuariosAsignables, actor, onClose, onSaved }: TareaFormModalProps) {
  const esEdicion = !!tarea;
  const esPropia = tarea?.creadoPor === actor.uid;
  const soloLectura = esEdicion && !canManage && !esPropia;

  const [titulo, setTitulo] = React.useState(tarea?.titulo ?? "");
  const [descripcion, setDescripcion] = React.useState(tarea?.descripcion ?? "");
  const [prioridad, setPrioridad] = React.useState<TareaPrioridad>(tarea?.prioridad ?? "media");
  const [asignadosA, setAsignadosA] = React.useState<string[]>(
    tarea?.asignadoA ? [tarea.asignadoA] : (canAssign ? [] : [actor.uid])
  );
  const [fechaLimite, setFechaLimite] = React.useState<Date | undefined>(
    tarea?.fechaLimite ? (tarea.fechaLimite as any).toDate() : undefined
  );
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const puedeAgregarSeguimiento = esEdicion && (esPropia || tarea?.asignadoA === actor.uid);
  const puedeGuardar = !soloLectura || puedeAgregarSeguimiento;
  const [seguimientos, setSeguimientos] = React.useState<TareaSeguimiento[]>([]);
  const [nuevoSeguimiento, setNuevoSeguimiento] = React.useState("");

  React.useEffect(() => {
    if (!esEdicion || !tarea?.id) return;
    return suscribirSeguimientosTarea(
      tarea.id,
      setSeguimientos,
      (err) => console.error("[TareaFormModal] Error cargando seguimientos:", err)
    );
  }, [esEdicion, tarea?.id]);

  function formatFechaSeguimiento(ts: any): string {
    if (!ts || typeof ts.toDate !== "function") return "";
    return ts.toDate().toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  async function onSubmit() {
    if (esEdicion && tarea?.id && soloLectura) {
      // Solo puede agregar seguimiento, los demás campos quedan intactos.
      if (!nuevoSeguimiento.trim()) return;
      setSaving(true);
      try {
        await addSeguimientoTarea(tarea.id, nuevoSeguimiento, { uid: actor.uid, nombre: actor.nombre });
        setNuevoSeguimiento("");
        toast.success("Seguimiento agregado.");
        onSaved();
      } catch (err) {
        console.error("[TareaFormModal] Error al agregar seguimiento:", err);
        toast.error("No se pudo agregar el seguimiento.");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!titulo.trim()) {
      toast.error("El título es obligatorio.");
      return;
    }
    const destinatarios = canAssign ? asignadosA : [actor.uid];
    if (destinatarios.length === 0 || destinatarios.some((uid) => !uid)) {
      toast.error("Selecciona al menos una persona.");
      return;
    }

    setSaving(true);
    try {
      if (esEdicion && tarea?.id) {
        const asignadoEfectivo = destinatarios[0];
        const usuarioAsignado = usuariosAsignables.find((e) => e.uid === asignadoEfectivo);
        await actualizarTarea(tarea.id, {
          titulo,
          descripcion,
          prioridad,
          fechaLimite: fechaLimite ? Timestamp.fromDate(fechaLimite) : null,
          asignadoA: asignadoEfectivo,
          asignadoNombre: canAssign
            ? usuarioAsignado?.nombre ?? ""
            : actor.nombre ?? tarea.asignadoNombre ?? "",
        });
        if (puedeAgregarSeguimiento && nuevoSeguimiento.trim()) {
          await addSeguimientoTarea(tarea.id, nuevoSeguimiento, { uid: actor.uid, nombre: actor.nombre });
          setNuevoSeguimiento("");
        }
        toast.success("Tarea actualizada.");
      } else {
        await Promise.all(
          destinatarios.map((uid) => {
            const usuarioAsignado = usuariosAsignables.find((e) => e.uid === uid);
            return crearTarea(
              {
                titulo,
                descripcion,
                prioridad,
                fechaLimite: fechaLimite ? Timestamp.fromDate(fechaLimite) : null,
                asignadoA: uid,
                asignadoNombre: canAssign
                  ? usuarioAsignado?.nombre ?? ""
                  : actor.nombre ?? "",
              },
              actor
            );
          })
        );
        toast.success(
          destinatarios.length > 1
            ? `Tarea grupal asignada a ${destinatarios.length} personas.`
            : "Tarea creada."
        );
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
    if (!tarea?.id || !canManage) return;
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
              {soloLectura || !canAssign ? (
                <p className="text-sm font-medium">{tarea?.asignadoNombre || actor.nombre || "—"}</p>
              ) : !esEdicion ? (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                  {usuariosAsignables.map((usuario) => {
                    const checked = asignadosA.includes(usuario.uid);
                    return (
                      <label
                        key={usuario.uid}
                        className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <Checkbox
                          checked={checked}
                          disabled={saving}
                          onCheckedChange={(value) =>
                            setAsignadosA((actuales) =>
                              value
                                ? [...actuales, usuario.uid]
                                : actuales.filter((uid) => uid !== usuario.uid)
                            )
                          }
                        />
                        <span>{usuario.nombre || usuario.email}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <Select
                  value={asignadosA[0] ?? ""}
                  onValueChange={(uid) => setAsignadosA([uid])}
                  disabled={saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una persona" />
                  </SelectTrigger>
                  <SelectContent>
                    {usuariosAsignables.map((e) => (
                      <SelectItem key={e.uid} value={e.uid}>{e.nombre || e.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {esEdicion && tarea?.creadoPorNombre && (
              <p className="text-xs text-muted-foreground">
                Creado por <span className="font-medium">{tarea.creadoPorNombre}</span>
              </p>
            )}

            {esEdicion && (
              <div className="space-y-2 border-t pt-3">
                <Label>Seguimiento</Label>
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {seguimientos.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin seguimientos aún.</p>
                  ) : (
                    seguimientos.map((s) => (
                      <div key={s.id} className="rounded-md bg-muted/50 p-2 text-xs">
                        <p className="whitespace-pre-wrap">{s.texto}</p>
                        <p className="mt-1 text-muted-foreground">
                          {formatFechaSeguimiento(s.fecha)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                {puedeAgregarSeguimiento && (
                  <Textarea
                    value={nuevoSeguimiento}
                    onChange={(e) => setNuevoSeguimiento(e.target.value)}
                    disabled={saving}
                    placeholder="Escribe en qué va la tarea..."
                    className="min-h-[60px]"
                  />
                )}
              </div>
            )}

            {!puedeGuardar ? (
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>
              </DialogFooter>
            ) : (
              <DialogFooter className="flex items-center justify-between sm:justify-between">
                {esEdicion && canManage ? (
                  <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)} disabled={saving}>
                    <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                  </Button>
                ) : <span />}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
                  <Button
                    type="submit"
                    disabled={saving || (soloLectura && !nuevoSeguimiento.trim())}
                  >
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
