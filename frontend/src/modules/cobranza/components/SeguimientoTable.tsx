// modules/cobranza/components/SeguimientoTable.tsx
import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

import SeguimientoForm from "./SeguimientoForm";
import { Seguimiento } from "../models/seguimiento.model";
import {
  getSeguimientos,
  addSeguimiento,
  updateSeguimiento,
  deleteSeguimiento,
  addSeguimientoJuridico,
  updateSeguimientoJuridico,
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
} from "@/components/ui/alert-dialog";

// 👉 Importa la tabla de Jurídico
import SeguimientoJuridicoTable from "./SeguimientoJuridicoTable";
import { Deudor } from "../models/deudores.model";

// Type compartido
export type DestinoColeccion = "seguimiento" | "seguimientoJuridico";

export default function SeguimientoTable() {
  const { clienteId, deudorId } = useParams();
  const navigate = useNavigate();

  const [deudor, setDeudor] = React.useState<Deudor | null>(null);
  const [items, setItems] = React.useState<Seguimiento[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [open, setOpen] = React.useState(false);
  const [seleccionado, setSeleccionado] = React.useState<Seguimiento | undefined>(undefined);

  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  // 👉 Cargar seguimientos pre-jurídico
  React.useEffect(() => {
    if (!clienteId || !deudorId) return;
    setLoading(true);
    getSeguimientos(clienteId, deudorId)
      .then(setItems)
      .catch(() => toast.error("No se pudo cargar el listado de seguimientos."))
      .finally(() => setLoading(false));
  }, [clienteId, deudorId]);

  // 👉 Guardar con destino dinámico
  const onSaveWithDestino = async (
    destino: DestinoColeccion,
    data: Omit<Seguimiento, "id">,
    archivo?: File,
    reemplazar?: boolean
  ) => {
    if (!clienteId || !deudorId) return;

    try {
      if (seleccionado?.id) {
        if (destino === "seguimientoJuridico") {
          await updateSeguimientoJuridico(clienteId, deudorId, seleccionado.id, data, archivo, reemplazar);
        } else {
          await updateSeguimiento(clienteId, deudorId, seleccionado.id, data, archivo, reemplazar);
        }
      } else {
        if (destino === "seguimientoJuridico") {
          await addSeguimientoJuridico(clienteId, deudorId, data, archivo);
        } else {
          await addSeguimiento(clienteId, deudorId, data, archivo);
        }
      }

      toast.success("Seguimiento guardado.");
      setOpen(false);
      setSeleccionado(undefined);
      setItems(await getSeguimientos(clienteId, deudorId));
    } catch {
      toast.error("No se pudo guardar el seguimiento.");
    }
  };

  // 👉 Eliminar
  const handleConfirmDelete = async () => {
    if (!clienteId || !deudorId || !deleteId) return;
    try {
      await deleteSeguimiento(clienteId, deudorId, deleteId);
      setItems((prev) => prev.filter((x) => x.id !== deleteId));
      toast.success("Seguimiento eliminado.");
    } catch {
      toast.error("No se pudo eliminar el seguimiento.");
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Botón volver */}
      <Button variant="ghost" className="mb-2" onClick={() => navigate(-1)}>
        ← Volver
      </Button>

      {/* Bloque Pre-jurídico */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Seguimiento Pre-Jurídico</h2>
          <Button
            onClick={() => {
              setSeleccionado(undefined);
              setOpen(true);
            }}
          >
            Nuevo seguimiento
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No hay seguimientos pre-jurídicos registrados.
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

        {/* Modal creación/edición */}
        <SeguimientoForm
          open={open}
          onClose={() => {
            setOpen(false);
            setSeleccionado(undefined);
          }}
          seguimiento={seleccionado}
          tipificacionDeuda={deudor?.tipificacion}
          onSaveWithDestino={onSaveWithDestino}
        />

        {/* Diálogo confirmación eliminación */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar seguimiento pre-jurídico?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. El seguimiento se eliminará permanentemente.
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

      {/* Bloque Jurídico */}
      <SeguimientoJuridicoTable />
    </div>
  );
}
