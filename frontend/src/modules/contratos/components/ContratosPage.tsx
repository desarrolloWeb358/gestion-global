import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { getAuth } from "firebase/auth";
import { FileText, Trash2, Download, Plus, Loader2 } from "lucide-react";

import { Typography } from "@/shared/design-system/components/Typography";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Separator } from "@/shared/ui/separator";
import AppBreadcrumb from "@/shared/components/app-breadcrumb";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/shared/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/shared/ui/alert-dialog";

import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import { getClienteById } from "@/modules/clientes/services/clienteService";

import {
  listarContratos, crearContrato, eliminarContrato, formatFechaContrato,
} from "../services/contratoService";
import type { Contrato } from "../models/contrato.model";

export default function ContratosPage() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const { can } = useAcl();
  const canEdit = can(PERMS.Contratos_Edit);

  const [clienteNombre, setClienteNombre] = useState("");
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);

  const [openForm, setOpenForm] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [archivos, setArchivos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Contrato | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!clienteId) return;
    Promise.all([
      getClienteById(clienteId).then((c) => setClienteNombre(c?.nombre ?? "")),
      listarContratos(clienteId).then(setContratos),
    ]).finally(() => setLoading(false));
  }, [clienteId]);

  const resetForm = () => {
    setTitulo("");
    setDescripcion("");
    setFecha(new Date().toISOString().slice(0, 10));
    setArchivos([]);
  };

  const handleGuardar = async () => {
    if (!clienteId || !titulo.trim()) {
      toast.error("El título es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const uid = getAuth().currentUser?.uid ?? "";
      await crearContrato(
        clienteId,
        { titulo: titulo.trim(), descripcion: descripcion.trim(), fecha: new Date(fecha + "T12:00:00") },
        archivos,
        uid
      );
      toast.success("Contrato guardado");
      setOpenForm(false);
      resetForm();
      setContratos(await listarContratos(clienteId));
    } catch {
      toast.error("Error al guardar el contrato");
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async () => {
    if (!clienteId || !deleteTarget) return;
    setDeleting(true);
    try {
      await eliminarContrato(clienteId, deleteTarget);
      toast.success("Contrato eliminado");
      setContratos(await listarContratos(clienteId));
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-5">
      <AppBreadcrumb
        items={[
          { label: "Clientes", href: "/clientes-tables" },
          { label: clienteNombre, href: `/clientes/${clienteId}` },
          { label: "Contratos" },
        ]}
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary shrink-0">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div className="min-w-0">
            <Typography variant="h1" className="!text-brand-secondary truncate">Contratos</Typography>
            <Typography variant="small" className="text-muted-foreground truncate">
              {clienteNombre}
            </Typography>
          </div>
        </div>

        {canEdit && (
          <Button variant="brand" className="gap-2 shrink-0" onClick={() => setOpenForm(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline">Nuevo contrato</span>
            <span className="xs:hidden">Nuevo</span>
          </Button>
        )}
      </div>

      <Separator className="bg-brand-secondary/20" />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        </div>
      ) : contratos.length === 0 ? (
        <div className="rounded-2xl border border-brand-secondary/20 bg-white p-8 sm:p-12 text-center shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 rounded-full bg-brand-primary/10">
              <FileText className="h-8 w-8 text-brand-primary/60" />
            </div>
            <Typography variant="h3" className="text-brand-secondary">Sin contratos</Typography>
            <Typography variant="small" className="text-muted-foreground">
              Aún no se han subido contratos para este cliente
            </Typography>
            {canEdit && (
              <Button variant="brand" className="mt-2 gap-2" onClick={() => setOpenForm(true)}>
                <Plus className="h-4 w-4" />
                Nuevo contrato
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {contratos.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <FileText className="h-4 w-4 text-brand-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 space-y-0.5">
                    <Typography variant="h3" className="!text-brand-secondary font-semibold leading-snug">
                      {c.titulo}
                    </Typography>
                    <Typography variant="small" className="text-muted-foreground">
                      {formatFechaContrato(c.fecha)}
                    </Typography>
                    {c.descripcion && (
                      <Typography variant="small" className="text-gray-600">
                        {c.descripcion}
                      </Typography>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(c)}
                    className="hover:bg-red-50 shrink-0 h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>

              {c.archivos.length > 0 && (
                <div className="mt-3 ml-6 flex flex-wrap gap-2">
                  {c.archivos.map((a, i) => (
                    <a
                      key={i}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-brand-secondary/20 bg-brand-primary/5 px-3 py-1.5 text-sm text-brand-primary hover:bg-brand-primary/10 transition-colors max-w-[200px] sm:max-w-xs"
                    >
                      <Download className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{a.nombre}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dialog nuevo contrato */}
      <Dialog open={openForm} onOpenChange={(v) => !saving && setOpenForm(v)}>
        <DialogContent
          className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-brand-primary font-bold">Nuevo contrato</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej: Contrato de prestación de servicios 2025"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Descripción breve"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                disabled={saving}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label>Archivos</Label>
              <Input
                type="file"
                multiple
                onChange={(e) => setArchivos(Array.from(e.target.files ?? []))}
                disabled={saving}
                className="cursor-pointer"
              />
              {archivos.length > 0 && (
                <Typography variant="small" className="text-muted-foreground">
                  {archivos.length} archivo(s) seleccionado(s)
                </Typography>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => { setOpenForm(false); resetForm(); }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              variant="brand"
              className="w-full sm:w-auto"
              onClick={handleGuardar}
              disabled={saving}
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Guardando…</> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminar */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteTarget?.titulo}</strong> y sus archivos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <AlertDialogCancel disabled={deleting} className="w-full sm:w-auto">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEliminar}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600 text-white w-full sm:w-auto"
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
