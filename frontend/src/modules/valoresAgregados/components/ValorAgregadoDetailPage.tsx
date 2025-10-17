"use client";

import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import { Separator } from "@/shared/ui/separator";
import { toast } from "sonner";

import { obtenerValorAgregado, timestampToDateInput } from "../services/valorAgregadoService";
import { ValorAgregado } from "../models/valorAgregado.model";
import { ObservacionCliente } from "@/modules/cobranza/models/observacionCliente.model";
import { TipoValorAgregadoLabels } from "../../../shared/constants/tipoValorAgregado";

import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import { getAuth } from "firebase/auth";

import {
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

function formatObsDate(input: any): string {
  try {
    if (input && typeof input.toDate === "function") return input.toDate().toLocaleString("es-CO", { hour12: false });
    if (input && typeof input.seconds === "number") return new Date(input.seconds * 1000).toLocaleString("es-CO", { hour12: false });
    if (input instanceof Date) return input.toLocaleString("es-CO", { hour12: false });
  } catch {}
  return "—";
}

export default function ValorAgregadoDetailPage() {
  const { clienteId, valorId } = useParams<{ clienteId: string; valorId: string }>();
  const navigate = useNavigate();

  const { can, roles = [] } = useAcl();
  const canView = can(PERMS.Valores_Read);
  // Si tienes un permiso específico para moderar observaciones, úsalo aquí
  const canModerate = can((PERMS as any).Valores_Obs_Manage ?? ("valores.obs.manage" as any));
  const isCliente = Array.isArray(roles) && roles.includes("cliente");
  const auth = getAuth();
  const currentUid = auth.currentUser?.uid || null;
  const currentName =
    auth.currentUser?.displayName || auth.currentUser?.email || roles[0] || "Usuario";

  // ===== Detalle
  const [item, setItem] = React.useState<ValorAgregado | null>(null);
  const [loading, setLoading] = React.useState(true);

  // ===== Observaciones (inline, scope = "valor")
  const [obs, setObs] = React.useState<ObservacionCliente[]>([]);
  const [obsLoading, setObsLoading] = React.useState(false);
  const [obsSaving, setObsSaving] = React.useState(false);
  const [obsWorking, setObsWorking] = React.useState(false);

  const [texto, setTexto] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingTexto, setEditingTexto] = React.useState("");
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const canCreate = isCliente || canModerate;
  const canEditObs = (o: ObservacionCliente) =>
    canModerate || (isCliente && !!currentUid && (o as any).creadoPorUid === currentUid);
  const canDeleteObs = canEditObs;

  React.useEffect(() => {
    if (!clienteId || !valorId) return;
    let canceled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await obtenerValorAgregado(clienteId, valorId);
        if (!canceled) setItem(data);
      } catch (e) {
        console.error(e);
        toast.error("No se pudo cargar el detalle.");
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [clienteId, valorId]);

  const fetchObs = React.useCallback(async () => {
    if (!clienteId || !valorId) return;
    setObsLoading(true);
    try {
      const data = await getObservacionesClienteValor(clienteId, valorId);
      setObs(data);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar las observaciones.");
    } finally {
      setObsLoading(false);
    }
  }, [clienteId, valorId]);

  React.useEffect(() => {
    fetchObs();
  }, [fetchObs]);

  async function onCreate() {
    if (!clienteId || !valorId) return;
    if (!canCreate) return toast.error("No tienes permiso para agregar observaciones.");
    const val = texto.trim();
    if (!val) return toast.error("Escribe la observación.");
    setObsSaving(true);
    try {
      await addObservacionClienteValor(clienteId, valorId, val, {
        creadoPorUid: currentUid,
        creadoPorNombre: currentName,
      });
      setTexto("");
      await fetchObs();
      toast.success("Observación agregada.");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo agregar la observación.");
    } finally {
      setObsSaving(false);
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
  async function onSaveEdit() {
    if (!clienteId || !valorId || !editingId) return;
    const t = editingTexto.trim();
    if (!t) return toast.error("El texto no puede estar vacío.");
    setObsWorking(true);
    try {
      await updateObservacionCliente(clienteId, valorId, editingId, t, "valor");
      setEditingId(null);
      setEditingTexto("");
      await fetchObs();
      toast.success("Observación actualizada.");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar la observación.");
    } finally {
      setObsWorking(false);
    }
  }

  function askDelete(o: ObservacionCliente) {
    if (!canDeleteObs(o)) return;
    setDeletingId(o.id!);
  }
  async function doDelete() {
    if (!clienteId || !valorId || !deletingId) return;
    setObsWorking(true);
    try {
      await deleteObservacionCliente(clienteId, valorId, deletingId, "valor");
      setDeletingId(null);
      await fetchObs();
      toast.success("Observación eliminada.");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo eliminar la observación.");
    } finally {
      setObsWorking(false);
    }
  }

  // ===== Guards
  if (loading) return <Spinner />;
  if (!item || !canView) {
    return (
      <div className="p-4 space-y-4">
        {!canView ? (
          <div className="text-sm">No tienes acceso a Valores agregados.</div>
        ) : (
          <div className="text-sm">No se encontró el registro</div>
        )}
        <Button variant="ghost" onClick={() => navigate(-1)}>← Volver</Button>
      </div>
    );
  }

  // ===== Render
  return (
    <div className="px-4 py-6 space-y-6">
      {/* Detalle */}
      <Card>
        <CardHeader><CardTitle>Detalle a del Valor Agregado</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground">
          <div><span className="font-medium text-foreground">Fecha:</span> {timestampToDateInput(item.fecha as any) || "—"}</div>
          <div><span className="font-medium text-foreground">Tipo:</span> {TipoValorAgregadoLabels[item.tipo]}</div>
          <div><span className="font-medium text-foreground">Título:</span> {item.titulo}</div>
          <div><span className="font-medium text-foreground">Detalle:</span> {item.descripcion || "—"}</div>
          <div>
            <span className="font-medium text-foreground">Archivo:</span>{" "}
            {item.archivoURL ? (
              <a className="text-primary underline" href={item.archivoURL} target="_blank" rel="noreferrer">
                {item.archivoNombre ?? "Ver archivo"}
              </a>
            ) : "—"}
          </div>
          <div className="pt-4">
            <Button variant="outline" onClick={() => navigate(`/clientes/${clienteId}/valores-agregados`)}>
              Volver al listado
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Observaciones del Cliente (inline, scope=valor) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Observaciones del cliente</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {obsLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : obs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin observaciones aún.</p>
          ) : (
            <div className="space-y-3">
              {obs.map((o) => {
                const fecha = formatObsDate((o as any).fecha || (o as any).creadoTs || (o as any).creadoEn);
                const editable = canEditObs(o);

                return (
                  <div key={o.id} className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground mb-1 flex items-center justify-between gap-2">
                      <span>{fecha}</span>
                    </div>

                    {editingId === o.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editingTexto}
                          onChange={(e) => setEditingTexto(e.target.value)}
                          className="min-h-24"
                          maxLength={1000}
                          disabled={obsWorking}
                        />
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" onClick={cancelEdit} disabled={obsWorking}>
                            Cancelar
                          </Button>
                          <Button onClick={onSaveEdit} disabled={obsWorking || !editingTexto.trim()}>
                            Guardar cambios
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm whitespace-pre-wrap">{o.texto}</div>
                        {editable && (
                          <div className="mt-2 flex items-center gap-2 justify-end">
                            <Button size="sm" variant="outline" onClick={() => startEdit(o)} disabled={obsWorking}>
                              Editar
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => askDelete(o)} disabled={obsWorking}>
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

          {(canCreate) && (
            <div className="pt-2 space-y-2">
              <Separator />
              <Label>Nueva observación</Label>
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escribe tu observación para el ejecutivo…"
                className="min-h-24"
                maxLength={1000}
                disabled={obsSaving || obsWorking}
              />
              <div className="flex justify-end">
                <Button onClick={onCreate} disabled={obsSaving || obsWorking || !texto.trim()}>
                  {obsSaving ? "Guardando…" : "Agregar observación"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
            <AlertDialogCancel onClick={() => setDeletingId(null)} disabled={obsWorking}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={doDelete}
              disabled={obsWorking}
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
