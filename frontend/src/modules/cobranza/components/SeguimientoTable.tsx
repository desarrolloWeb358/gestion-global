// modules/cobranza/components/SeguimientoTable.tsx
import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/shared/ui/table";
import {
  codeToLabel
} from "@/shared/constants/tipoSeguimiento";

import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";

import SeguimientoForm, { DestinoColeccion } from "./SeguimientoForm";
import { Seguimiento } from "../models/seguimiento.model";
import {
  getSeguimientos,
  addSeguimiento,
  updateSeguimiento,
  deleteSeguimiento,
  addSeguimientoJuridico,
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
import { Textarea } from "@/shared/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/card";

import type { ObservacionCliente } from "@/modules/cobranza/models/observacionCliente.model";
import {
  getObservacionesCliente,
  addObservacionCliente,
} from "@/modules/cobranza/services/observacionClienteService";

import { getAuth } from "firebase/auth";
import SeguimientoJuridicoTable from "./SeguimientoJuridicoTable";

function renderTipoSeguimiento(code?: string) {
  return codeToLabel[code as keyof typeof codeToLabel] ?? code ?? "—";
}

export default function SeguimientoTable() {
  const { clienteId, deudorId } = useParams();
  const navigate = useNavigate();

  // ===== estado =====
  const [items, setItems] = React.useState<Seguimiento[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [open, setOpen] = React.useState(false);
  const [seleccionado, setSeleccionado] = React.useState<Seguimiento | undefined>(undefined);

  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [refreshJuridicoKey, setRefreshJuridicoKey] = React.useState(0);

  // ===== RBAC =====
  const { can, loading: aclLoading, roles = [] } = useAcl(); // roles default []
  const canView = can(PERMS.Seguimientos_Read);
  const canEdit = can(PERMS.Seguimientos_Edit);
  const isCliente = Array.isArray(roles) && roles.includes("cliente");
  const canEditSafe = canEdit && !isCliente; // defensa extra
  const [obsCliente, setObsCliente] = React.useState<ObservacionCliente[]>([]);
  const [obsLoading, setObsLoading] = React.useState(false);
  const [obsTexto, setObsTexto] = React.useState("");
  const auth = getAuth();

  // ===== efectos (siempre se declaran antes de cualquier return) =====
  React.useEffect(() => {
    if (!clienteId || !deudorId) return;
    setLoading(true);
    getSeguimientos(clienteId, deudorId)
      .then(setItems)
      .catch(() => toast.error("No se pudo cargar el listado de seguimientos."))
      .finally(() => setLoading(false));
  }, [clienteId, deudorId]);
  React.useEffect(() => {
    if (!clienteId || !deudorId) return;
    setObsLoading(true);
    getObservacionesCliente(clienteId, deudorId)
      .then(setObsCliente)
      .catch(() => toast.error("No se pudieron cargar las observaciones del cliente."))
      .finally(() => setObsLoading(false));
  }, [clienteId, deudorId]);
  // ===== handlers =====
  const onSaveWithDestino = async (
    destino: DestinoColeccion,
    data: Omit<Seguimiento, "id">,
    archivo?: File,
    reemplazar?: boolean
  ) => {
    if (!clienteId || !deudorId) return;

    // 🚫 bloquea si no tiene permiso
    if (!canEditSafe) {
      toast.error("No tienes permiso para crear/editar seguimientos.");
      return;
    }

    try {
      if (seleccionado?.id) {
        // Editar (pre-jurídico)
        if (destino === "seguimientoJuridico") {
          // mover a jurídico: crear allá y borrar aquí
          await addSeguimientoJuridico(clienteId, deudorId, data, archivo);
          await deleteSeguimiento(clienteId, deudorId, seleccionado.id);
          setRefreshJuridicoKey((k) => k + 1);
        } else {
          await updateSeguimiento(
            clienteId,
            deudorId,
            seleccionado.id,
            data,
            archivo,
            reemplazar
          );
        }
      } else {
        // Crear
        if (destino === "seguimientoJuridico") {
          await addSeguimientoJuridico(clienteId, deudorId, data, archivo);
          setRefreshJuridicoKey((k) => k + 1);
        } else {
          await addSeguimiento(clienteId, deudorId, data, archivo);
        }
      }

      toast.success("Seguimiento guardado.");
      setOpen(false);
      setSeleccionado(undefined);

      // refrescar pre-jurídico
      setItems(await getSeguimientos(clienteId, deudorId));
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar el seguimiento.");
    }
  };



  const handleConfirmDelete = async () => {
    if (!clienteId || !deudorId || !deleteId) return;

    // 🚫 bloquea si no tiene permiso
    if (!canEditSafe) {
      toast.error("No tienes permiso para eliminar seguimientos.");
      setDeleteId(null);
      return;
    }

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
  const handleAgregarObservacion = async () => {
    if (!clienteId || !deudorId) return;
    if (!isCliente) {
      toast.error("Solo el cliente puede agregar observaciones.");
      return;
    }
    const texto = obsTexto.trim();
    if (!texto) {
      toast.error("Escribe la observación.");
      return;
    }

    try {
      const uid = auth.currentUser?.uid ?? null;
      await addObservacionCliente(clienteId, deudorId, texto);
      setObsTexto("");
      setObsCliente(await getObservacionesCliente(clienteId, deudorId));
      toast.success("Observación agregada.");
      // La Cloud Function (sección 4) enviará el correo automáticamente.
    } catch (e) {
      console.error(e);
      toast.error("No se pudo agregar la observación.");
    }
  };

  // ===== guard de UI (no rompe hooks: se retorna al final) =====
  let guard: React.ReactNode | null = null;
  if (aclLoading) {
    guard = <p className="p-4 text-sm">Cargando permisos…</p>;
  } else if (!canView) {
    guard = <p className="p-4 text-sm">No tienes acceso a Seguimientos.</p>;
  }

  if (guard) {
    return (
      <div className="space-y-2">
        <Button variant="ghost" className="mb-2" onClick={() => navigate(-1)}>
          ← Volver
        </Button>
        {guard}
      </div>
    );
  }

  // ===== render =====
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

          {/* “Nuevo seguimiento” solo si puede editar */}
          {canEditSafe && (
            <Button
              onClick={() => {
                setSeleccionado(undefined);
                setOpen(true);
              }}
            >
              Nuevo seguimiento
            </Button>
          )}
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
                {/* Columna Acciones solo si puede editar */}
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

                  {/* Acciones por fila solo si puede editar */}
                  {canEditSafe && (
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
                  )}
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
          tipificacionDeuda={undefined} // si no lo usas aquí, evita pasar algo no definido
          onSaveWithDestino={onSaveWithDestino}
          destinoInicial="seguimiento" // importante desde Prejurídico
        />

        {/* Diálogo confirmación eliminación */}
        <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
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

      {/* === Observaciones del Cliente === */}



      {/* Bloque Jurídico (se recarga cuando cambia refreshJuridicoKey) */}
      <SeguimientoJuridicoTable key={refreshJuridicoKey} />
      <Card>
        <CardHeader>
          <CardTitle>Observaciones del cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Lista */}
          {obsLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : obsCliente.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay observaciones del cliente.</p>
          ) : (
            <div className="space-y-3">
              {obsCliente.map((o) => {
                const fecha =
                  (o.fecha as any)?.toDate?.() instanceof Date
                    ? (o.fecha as any).toDate().toLocaleString("es-CO", { hour12: false })
                    : "—";
                return (
                  <div key={o.id} className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground mb-1">{fecha}</div>
                    <div className="text-sm whitespace-pre-wrap">{o.texto}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Formulario solo para CLIENTE */}
          {isCliente && (
            <div className="space-y-2">
              <Textarea
                value={obsTexto}
                onChange={(e) => setObsTexto(e.target.value)}
                className="min-h-24"
                placeholder="Escribe tu observación para el ejecutivo…"
              />
              <div className="flex justify-end">
                <Button onClick={handleAgregarObservacion}>Agregar observación</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
