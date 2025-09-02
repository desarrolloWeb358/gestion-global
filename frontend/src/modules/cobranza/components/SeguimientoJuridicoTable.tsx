// modules/cobranza/components/SeguimientoJuridicoTable.tsx
import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import type { Deudor } from "../models/deudores.model";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/shared/ui/table";

import SeguimientoForm from "./SeguimientoForm";
import { DestinoColeccion } from "./SeguimientoForm";
import { Seguimiento } from "../models/seguimiento.model";

import {
  getSeguimientosJuridico,
  addSeguimientoJuridico,
  updateSeguimientoJuridico,
  deleteSeguimientoJuridico,
} from "@/modules/cobranza/services/seguimientoService";

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

export default function SeguimientoJuridicoTable() {
  const { clienteId, deudorId } = useParams();
  const navigate = useNavigate();
  const [deudor, setDeudor] = React.useState<Deudor | null>(null);

  const [items, setItems] = React.useState<Seguimiento[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [open, setOpen] = React.useState(false);
  const [seleccionado, setSeleccionado] = React.useState<Seguimiento | undefined>(undefined);

  // estado para confirmación de eliminación
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  // Cargar seguimientos jurídico
  React.useEffect(() => {
    if (!clienteId || !deudorId) return;
    setLoading(true);
    getSeguimientosJuridico(clienteId, deudorId)
      .then(setItems)
      .catch(() => toast.error("No se pudo cargar el listado de seguimientos jurídicos."))
      .finally(() => setLoading(false));
  }, [clienteId, deudorId]);

  // Guardar (crear/editar)
  const onSave = async (data: Omit<Seguimiento, "id">, archivo?: File, reemplazar?: boolean) => {
    if (!clienteId || !deudorId) return;
    try {
      if (seleccionado?.id) {
        await updateSeguimientoJuridico(clienteId, deudorId, seleccionado.id, data, archivo, reemplazar);
      } else {
        await addSeguimientoJuridico(clienteId, deudorId, data, archivo);
      }
      toast.success("Seguimiento jurídico guardado.");
      setOpen(false);
      setSeleccionado(undefined);
      setItems(await getSeguimientosJuridico(clienteId, deudorId));
    } catch {
      toast.error("No se pudo guardar el seguimiento jurídico.");
    }
  };

  // Ejecutar eliminación (confirmada en el diálogo)
  const handleConfirmDelete = async () => {
    if (!clienteId || !deudorId || !deleteId) return;
    try {
      await deleteSeguimientoJuridico(clienteId, deudorId, deleteId);
      setItems((prev) => prev.filter((x) => x.id !== deleteId));
      toast.success("Seguimiento jurídico eliminado.");
    } catch {
      toast.error("No se pudo eliminar el seguimiento jurídico.");
    } finally {
      setDeleteId(null);
    }
  };

  function onSaveWithDestino(destino: DestinoColeccion, data: Omit<Seguimiento, "id">, archivo?: File | undefined, reemplazar?: boolean | undefined): Promise<void> {
    throw new Error("Function not implemented.");
  }

  return (
    <div className="space-y-4">
      {/* Header limpio */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Seguimiento Jurídico</h2>
      </div>

      {/* Tabla */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No hay seguimientos jurídicos registrados.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Fecha</TableHead>
              <TableHead className="w-[160px]">Tipo</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-[140px]">Archivo</TableHead>
              <TableHead className="w-[160px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((seg) => (
              <TableRow key={seg.id}>
                <TableCell>
                  {seg.fecha ? seg.fecha.toDate().toLocaleString() : "—"}
                </TableCell>
                <TableCell className="capitalize">
                  {seg.tipoSeguimiento ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="whitespace-pre-wrap leading-relaxed text-sm">
                    {seg.descripcion}
                  </div>
                </TableCell>
                <TableCell>
                  {seg.archivoUrl ? (
                    <a
                      href={seg.archivoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-sm"
                    >
                      Ver archivo
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSeleccionado(seg);
                      setOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDeleteId(seg.id!)}
                  >
                    Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Modal de creación/edición */}
      <SeguimientoForm
        open={open}
        onClose={() => {
          setOpen(false);
          setSeleccionado(undefined);
        }}
        seguimiento={seleccionado}
        tipificacionDeuda={deudor?.tipificacion}
        onSaveWithDestino={onSaveWithDestino}  // 👈 usa esta en lugar de onSave
      />

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
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
