// modules/cobranza/components/SeguimientoJuridicoTable.tsx
import * as React from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Scale, Edit, Trash2, Download, FileText } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/shared/ui/table";

import SeguimientoForm, { DestinoColeccion } from "./SeguimientoForm";
import { Seguimiento } from "../models/seguimiento.model";
import type { Deudor } from "../models/deudores.model";

import {
  getSeguimientosJuridico,
  addSeguimientoJuridico,
  updateSeguimientoJuridico,
  deleteSeguimientoJuridico,
} from "@/modules/cobranza/services/seguimientoService";

import { codeToLabel } from "@/shared/constants/tipoSeguimiento";

import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/shared/ui/alert-dialog";
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import { getAuth } from "firebase/auth";

function renderTipoSeguimiento(code?: string) {
  return codeToLabel[code as keyof typeof codeToLabel] ?? code ?? "—";
}

function toDate(v: any): Date | undefined {
  try {
    if (!v) return undefined;
    if (typeof v?.toDate === "function") return v.toDate();
    if (v instanceof Date) return v;
    if (typeof v === "number") return new Date(v);
    if (typeof v === "string") {
      const t = Date.parse(v);
      return Number.isNaN(t) ? undefined : new Date(t);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function tsToMillis(v: any): number {
  const d = toDate(v);
  return d ? d.getTime() : 0;
}

export default function SeguimientoJuridicoTable() {
  const { clienteId, deudorId } = useParams();
  const auth = getAuth();

  const [deudor, setDeudor] = React.useState<Deudor | null>(null);
  const [items, setItems] = React.useState<Seguimiento[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [seleccionado, setSeleccionado] = React.useState<Seguimiento | undefined>(undefined);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  const itemsSorted = React.useMemo(() => {
    return [...items].sort((a, b) => tsToMillis(b.fecha) - tsToMillis(a.fecha)); // DESC: más reciente primero
  }, [items]);


  // RBAC
  const { can, roles = [], loading: aclLoading } = useAcl();
  const isCliente = roles.includes("cliente");
  const canView = isCliente || can(PERMS.Seguimientos_Ejecutivos_Read);
  const canEdit = !isCliente && can(PERMS.Seguimientos_Ejecutivos_Edit);
  const canEditSafe = canEdit && !isCliente;

  React.useEffect(() => {
    if (!clienteId || !deudorId) return;
    setLoading(true);
    getSeguimientosJuridico(clienteId, deudorId)
      .then(setItems)
      .catch(() => toast.error("⚠️ No se pudo cargar el listado de seguimientos jurídicos"))
      .finally(() => setLoading(false));
  }, [clienteId, deudorId]);

  const onSave = async (
    data: Omit<Seguimiento, "id">,
    archivo?: File,
    reemplazar?: boolean
  ) => {
    if (!clienteId || !deudorId) return;
    if (!canEdit) {
      toast.error("No tienes permiso para editar seguimientos jurídicos");
      return;
    }
    try {
      const uidUsuario = auth.currentUser?.uid;
      if (!uidUsuario) {
        toast.error("No se pudo obtener el usuario autenticado");
        return;
      }

      if (seleccionado?.id) {
        await updateSeguimientoJuridico(clienteId, deudorId, seleccionado.id, data, archivo, reemplazar);
      } else {
        await addSeguimientoJuridico(uidUsuario, clienteId, deudorId, data, archivo);
      }
      toast.success("✓ Seguimiento jurídico guardado correctamente");
      setOpen(false);
      setSeleccionado(undefined);
      setItems(await getSeguimientosJuridico(clienteId, deudorId));
    } catch (error) {
      console.error(error);
      toast.error("⚠️ No se pudo guardar el seguimiento jurídico");
    }
  };

  const handleConfirmDelete = async () => {
    if (!clienteId || !deudorId || !deleteId) return;
    if (!canEdit) {
      toast.error("No tienes permiso para eliminar seguimientos jurídicos");
      setDeleteId(null);
      return;
    }
    try {
      await deleteSeguimientoJuridico(clienteId, deudorId, deleteId);
      setItems((prev) => prev.filter((x) => x.id !== deleteId));
      toast.success("✓ Seguimiento jurídico eliminado");
    } catch {
      toast.error("⚠️ No se pudo eliminar el seguimiento jurídico");
    } finally {
      setDeleteId(null);
    }
  };

  async function onSaveWithDestino(
    _destino: DestinoColeccion,
    data: Omit<Seguimiento, "id">,
    archivo?: File,
    reemplazar?: boolean
  ): Promise<void> {
    return onSave(data, archivo, reemplazar);
  }

  if (aclLoading) {
    return (
      <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-3" />
        <Typography variant="small" className="text-muted">
          Cargando permisos...
        </Typography>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
        <div className="p-3 rounded-full bg-red-100 inline-block mb-3">
          <Scale className="h-6 w-6 text-red-600" />
        </div>
        <Typography variant="body" className="text-muted">
          No tienes acceso a seguimientos jurídicos
        </Typography>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
            <Typography variant="body" className="text-muted">
              Cargando seguimientos jurídicos...
            </Typography>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 rounded-full bg-brand-primary/10">
              <Scale className="h-8 w-8 text-brand-primary/60" />
            </div>
            <Typography variant="h3" className="text-brand-secondary">
              No hay seguimientos jurídicos
            </Typography>
            <Typography variant="small" className="text-muted">
              Aún no se han registrado seguimientos jurídicos para este deudor
            </Typography>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                  <TableHead className="w-[140px] text-brand-secondary font-semibold">Fecha</TableHead>
                  <TableHead className="w-[160px] text-brand-secondary font-semibold">Tipo</TableHead>
                  <TableHead className="text-brand-secondary font-semibold">Descripción</TableHead>
                  <TableHead className="w-[120px] text-brand-secondary font-semibold">Archivo</TableHead>
                  {canEditSafe && (
                    <TableHead className="w-[180px] text-center text-brand-secondary font-semibold">Acciones</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsSorted.map((seg, index) => (
                  <TableRow
                    key={seg.id}
                    className={cn(
                      "border-brand-secondary/5 transition-colors",
                      index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]",
                      "hover:bg-brand-primary/5"
                    )}
                  >
                    <TableCell className="text-gray-700 font-medium">
                      {seg.fecha && typeof (seg.fecha as any).toDate === "function"
                        ? (seg.fecha as any).toDate().toLocaleDateString("es-CO")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-orange-100 border border-orange-200 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                        {renderTipoSeguimiento(seg.tipoSeguimiento)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="whitespace-pre-wrap leading-relaxed text-sm text-gray-700">
                        {seg.descripcion}
                      </div>
                    </TableCell>
                    <TableCell>
                      {seg.archivoUrl ? (
                        <a
                          href={seg.archivoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-brand-primary hover:text-brand-secondary transition-colors text-sm font-medium"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Ver
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    {canEditSafe && (
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSeleccionado(seg);
                              setOpen(true);
                            }}
                            className="hover:bg-brand-primary/10"
                          >
                            <Edit className="h-4 w-4 text-brand-primary" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteId(seg.id!)}
                            className="hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <SeguimientoForm
        open={open}
        onClose={() => {
          setOpen(false);
          setSeleccionado(undefined);
        }}
        seguimiento={seleccionado}
        tipificacionDeuda={deudor?.tipificacion}
        onSaveWithDestino={onSaveWithDestino}
        destinoInicial="seguimientoJuridico"
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar seguimiento jurídico?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El seguimiento jurídico se eliminará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleConfirmDelete}
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}