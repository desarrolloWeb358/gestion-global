// modules/cobranza/components/SeguimientoJuridicoTable.tsx
import * as React from "react";
import { useParams} from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import type { Deudor } from "../models/deudores.model";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/shared/ui/table";

import SeguimientoForm, { DestinoColeccion } from "./SeguimientoForm";
import { Seguimiento } from "../models/seguimiento.model";

import {
  getSeguimientosJuridico,
  addSeguimientoJuridico,
  updateSeguimientoJuridico,
  deleteSeguimientoJuridico,
} from "@/modules/cobranza/services/seguimientoService";

import { codeToLabel } from "@/shared/constants/tipoSeguimiento";

// ⬇️ RBAC
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/shared/ui/alert-dialog";
import SeguimientoDemandaTableHandle from "./SeguimientoDemandaTable";
import { SeguimientoDemanda } from "../services/seguimientoDemandaService";



function renderTipoSeguimiento(code?: string) {
  // Si el code existe en el mapa, devuelve el label; si no, muestra el code o '—'
  return codeToLabel[code as keyof typeof codeToLabel] ?? code ?? "—";
}

const SeguimientoDemandaTable = React.forwardRef<SeguimientoDemanda, {}>(function SeguimientoDemandaTable(_, ref) {
  const { clienteId, deudorId } = useParams();
  const [deudor, setDeudor] = React.useState<Deudor | null>(null);
  const [items, setItems] = React.useState<Seguimiento[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [seleccionado, setSeleccionado] = React.useState<Seguimiento | undefined>(undefined);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    demandados: "",
    juzgado: "",
    numeroRadicado: "",
    localidad: "",
    observacionesDemanda: "",
    observacionesDemandaCliente: "",
    fechaUltimaRevision: "", // YYYY-MM-DD
  });


  // RBAC
  const { can, roles = [], loading: aclLoading } = useAcl();

  const isCliente = roles.includes("cliente");
  
  

  // 👉 Permisos: cliente SIEMPRE puede ver; editar solo si NO es cliente y tiene permiso
  const canView =
    isCliente || can(PERMS.Seguimientos_Read ?? PERMS.Abonos_Read); // fallback si aún no definiste los permisos
  const canEdit =
    !isCliente && can(PERMS.Seguimientos_Edit ?? PERMS.Abonos_Edit);
  const canEditSafe = canEdit && !isCliente;

  

  

  React.useEffect(() => {
    if (!clienteId || !deudorId) return;
    setLoading(true);
    getSeguimientosJuridico(clienteId, deudorId)
      .then(setItems)
      .catch(() => toast.error("No se pudo cargar el listado de seguimientos jurídicos."))
      .finally(() => setLoading(false));
  }, [clienteId, deudorId]);

  // Guardar (crear/editar) — protegido por RBAC
  const onSave = async (
    data: Omit<Seguimiento, "id">,
    archivo?: File,
    reemplazar?: boolean
  ) => {
    if (!clienteId || !deudorId) return;
    if (!canEdit) {
      toast.error("No tienes permiso para editar seguimientos jurídicos.");
      return;
    }
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

  // Eliminar — protegido por RBAC
  const handleConfirmDelete = async () => {
    if (!clienteId || !deudorId || !deleteId) return;
    if (!canEdit) {
      toast.error("No tienes permiso para eliminar seguimientos jurídicos.");
      setDeleteId(null);
      return;
    }
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

  // API esperada por el form (con destino); en este caso, reusa onSave y respeta RBAC
  async function onSaveWithDestino(
    _destino: DestinoColeccion,
    data: Omit<Seguimiento, "id">,
    archivo?: File,
    reemplazar?: boolean
  ): Promise<void> {
    // Si usaras distintos destinos (p. ej., mover a otra colección), condicional acá.
    return onSave(data, archivo, reemplazar);
  }

  // Estados de acceso
  if (aclLoading) return <p className="text-sm text-muted-foreground">Cargando permisos…</p>;
  if (!canView) return <p className="text-sm text-muted-foreground">No tienes acceso a Seguimiento Jurídico.</p>;

  return (
    <div className="space-y-4">
      {/* Header limpio, sin el Card adentro */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Seguimiento Jurídico</h2>

        {/* Si quieres un botón aquí (ej. "Nuevo seguimiento"), va bien al lado del título */}
        {/* {canEdit && (
          <Button size="sm" onClick={() => { setSeleccionado(undefined); setOpen(true); }}>
            Agregar seguimiento
          </Button>
        )} */}
      </div>

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
              {canEditSafe && (
                <TableHead className="w-[160px] text-right">Acciones</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((seg) => (
              <TableRow key={seg.id}>
                <TableCell>
                  {seg.fecha && typeof (seg.fecha as any).toDate === "function"
                    ? (seg.fecha as any).toDate().toLocaleDateString("es-CO")
                    : "—"}
                </TableCell>
                <TableCell className="capitalize">
                  {renderTipoSeguimiento(seg.tipoSeguimiento)}
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
                  {canEdit ? (
                    <>
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
                    </>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Modal de creación/edición */}
      <SeguimientoForm
        open={open}
        onClose={() => { setOpen(false); setSeleccionado(undefined); }}
        seguimiento={seleccionado}
        tipificacionDeuda={deudor?.tipificacion}
        onSaveWithDestino={onSaveWithDestino}
      />

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar seguimiento jurídico?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El seguimiento jurídico se eliminará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancelar</AlertDialogCancel>
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
});
export default SeguimientoDemandaTable;