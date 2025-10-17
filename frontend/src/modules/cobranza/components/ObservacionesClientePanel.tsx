"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Separator } from "@/shared/ui/separator";
import { toast } from "sonner";

import type { ObservacionCliente } from "@/modules/cobranza/models/observacionCliente.model";

import {
  getObservacionesCliente,
  addObservacionCliente,
  getObservacionesClienteValor,
  addObservacionClienteValor,
  updateObservacionCliente,
  deleteObservacionCliente,
} from "@/modules/cobranza/services/observacionClienteService";

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

type Scope = "deudor" | "valor";

/** Formatea Timestamp/FieldValue/Date a string local es-CO */
function formatObsDate(input: any): string {
  try {
    if (!input) return "—";
    if (typeof input?.toDate === "function") {
      return input.toDate().toLocaleString("es-CO", { hour12: false });
    }
    if (typeof input?.seconds === "number") {
      return new Date(input.seconds * 1000).toLocaleString("es-CO", { hour12: false });
    }
    if (input instanceof Date) {
      return input.toLocaleString("es-CO", { hour12: false });
    }
  } catch {}
  return "—";
}

export interface ObservacionesClientePanelProps {
  clienteId: string;
  /** parentId: deudorId (scope="deudor") o valorId (scope="valor") */
  parentId: string;
  scope: Scope;

  /** Permisos/rol resueltos desde afuera */
  isCliente?: boolean;
  canModerate?: boolean;

  /** Título visual del card (opcional) */
  title?: string;

  /** Mostrar formulario de crear (por defecto true si es cliente o moderador) */
  allowCreate?: boolean;
}

export default function ObservacionesClientePanel({
  clienteId,
  parentId,
  scope,
  isCliente = false,
  canModerate = false,
  title = "Observaciones del cliente",
  allowCreate,
}: ObservacionesClientePanelProps) {
  const [items, setItems] = React.useState<ObservacionCliente[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [working, setWorking] = React.useState(false);

  const [texto, setTexto] = React.useState("");

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingTexto, setEditingTexto] = React.useState("");
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Crear permitido si es cliente o moderador (puedes pasar allowCreate para forzar)
  const canCreate = allowCreate ?? (isCliente || canModerate);

  const fetch = React.useCallback(async () => {
    if (!clienteId || !parentId) return;
    setLoading(true);
    try {
      const data =
        scope === "deudor"
          ? await getObservacionesCliente(clienteId, parentId)
          : await getObservacionesClienteValor(clienteId, parentId);
      setItems(data);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar las observaciones del cliente.");
    } finally {
      setLoading(false);
    }
  }, [clienteId, parentId, scope]);

  React.useEffect(() => {
    fetch();
  }, [fetch]);

  // Ahora los permisos no dependen del autor, porque ya no guardamos creadoPor*
  const canEditObs = (o: ObservacionCliente) => isCliente || canModerate;
  const canDeleteObs = canEditObs;

  async function onCreate() {
    if (!clienteId || !parentId) return;
    if (!canCreate) return toast.error("No tienes permiso para agregar observaciones.");
    const val = texto.trim();
    if (!val) return toast.error("Escribe la observación.");

    setSaving(true);
    try {
      if (scope === "deudor") {
        await addObservacionCliente(clienteId, parentId, val); // ← sin metadatos
      } else {
        await addObservacionClienteValor(clienteId, parentId, val); // ← sin metadatos
      }
      setTexto("");
      await fetch();
      toast.success("Observación agregada.");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo agregar la observación.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(o: ObservacionCliente) {
    if (!canEditObs(o)) return;
    setEditingId(o.id!);
    setEditingTexto(o.texto);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingTexto("");
  }

  async function confirmEdit() {
    if (!clienteId || !parentId || !editingId) return;
    const nuevo = editingTexto.trim();
    if (!nuevo) return toast.error("El texto no puede estar vacío.");

    setWorking(true);
    try {
      await updateObservacionCliente(clienteId, parentId, editingId, nuevo, scope);
      toast.success("Observación actualizada.");
      setEditingId(null);
      setEditingTexto("");
      await fetch();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar la observación.");
    } finally {
      setWorking(false);
    }
  }

  function askDelete(o: ObservacionCliente) {
    if (!canDeleteObs(o)) return;
    setDeletingId(o.id!);
  }

  async function doDelete() {
    if (!clienteId || !parentId || !deletingId) return;
    setWorking(true);
    try {
      await deleteObservacionCliente(clienteId, parentId, deletingId, scope);
      toast.success("Observación eliminada.");
      setDeletingId(null);
      await fetch();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo eliminar la observación.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Lista: solo FECHA + TEXTO */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin observaciones aún.</p>
        ) : (
          <div className="space-y-3">
            {items.map((o) => {
              // intenta usar o.fecha || o.fechaTs || creadoTs/creadoEn por retrocompatibilidad
              const fecha =
                formatObsDate((o as any).fecha ?? (o as any).fechaTs ?? (o as any).creadoTs ?? (o as any).creadoEn);

              return (
                <div key={o.id} className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground mb-1">{fecha}</div>

                  {editingId === o.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingTexto}
                        onChange={(e) => setEditingTexto(e.target.value)}
                        className="min-h-24"
                        maxLength={1000}
                        disabled={working}
                      />
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" onClick={cancelEdit} disabled={working}>
                          Cancelar
                        </Button>
                        <Button onClick={confirmEdit} disabled={working || !editingTexto.trim()}>
                          Guardar cambios
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm whitespace-pre-wrap">{o.texto}</div>
                      {(isCliente || canModerate) && (
                        <div className="mt-2 flex items-center gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => startEdit(o)} disabled={working}>
                            Editar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => askDelete(o)} disabled={working}>
                            Eliminar
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Form crear */}
        {canCreate && (
          <div className="pt-2 space-y-2">
            <Separator />
            <Label>Nueva observación</Label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe tu observación…"
              className="min-h-24"
              maxLength={1000}
              disabled={saving || working}
            />
            <div className="flex justify-end">
              <Button onClick={onCreate} disabled={saving || working || !texto.trim()}>
                {saving ? "Guardando…" : "Agregar observación"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Confirmación eliminar */}
      <AlertDialog open={!!deletingId} onOpenChange={(v) => !v && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar observación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La observación se eliminará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)} disabled={working}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={doDelete} disabled={working}>
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
