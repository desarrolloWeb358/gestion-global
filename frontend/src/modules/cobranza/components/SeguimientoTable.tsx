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

// Tabs
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";

// 🔎 Filtros reutilizables
import FiltersBar from "@/shared/table-filters/FiltersBar";
import type { DateRange, FilterField } from "@/shared/table-filters/types";

// Select inline (orden)
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/shared/ui/select";

// ==== helpers de fechas/orden ====
type SortDir = "desc" | "asc";

function toDate(v: any): Date | undefined {
  try {
    if (!v) return undefined;
    if (typeof v?.toDate === "function") return v.toDate(); // Firestore Timestamp
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
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime(); // Firestore Timestamp
    if (v instanceof Date) return v.getTime();
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const t = Date.parse(v);
      return Number.isNaN(t) ? 0 : t;
    }
    return 0;
  } catch {
    return 0;
  }
}

function inRange(millis: number, range?: DateRange): boolean {
  if (!range || (!range.from && !range.to)) return true;
  const from = range.from ? new Date(range.from.setHours(0, 0, 0, 0)).getTime() : undefined;
  const to = range.to ? new Date(range.to.setHours(23, 59, 59, 999)).getTime() : undefined;
  if (from !== undefined && millis < from) return false;
  if (to !== undefined && millis > to) return false;
  return true;
}

export default function SeguimientoTable() {
  const { clienteId, deudorId } = useParams();
  const navigate = useNavigate();

  // ===== estado (pre-jurídico) =====
  const [items, setItems] = React.useState<Seguimiento[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [seleccionado, setSeleccionado] = React.useState<Seguimiento | undefined>(undefined);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  // ===== refresco jurídico =====
  const [refreshJuridicoKey, setRefreshJuridicoKey] = React.useState(0);

  // ===== RBAC =====
  const { can, loading: aclLoading, roles = [] } = useAcl();
  const canView = can(PERMS.Seguimientos_Read);
  const canEdit = can(PERMS.Seguimientos_Edit);
  const isCliente = Array.isArray(roles) && roles.includes("cliente");
  const canEditSafe = canEdit && !isCliente;

  // ===== observaciones cliente =====
  const [obsCliente, setObsCliente] = React.useState<ObservacionCliente[]>([]);
  const [obsLoading, setObsLoading] = React.useState(false);
  const [obsTexto, setObsTexto] = React.useState("");
  const auth = getAuth();

  // ===== pestaña activa =====
  const [tab, setTab] = React.useState<"pre" | "juridico" | "obs">("pre");

  // ===== filtros: PRE-JURÍDICO =====
  type PreFilters = { fecha?: DateRange; order: SortDir };
  const [preFilters, setPreFilters] = React.useState<PreFilters>({ order: "desc" });
  const setPreFilter = (key: keyof PreFilters, value: any) =>
    setPreFilters((s) => ({ ...s, [key]: value }));

  // solo daterange en FiltersBar (sacamos "order")
  const preFields: FilterField<Seguimiento>[] = [
    {
      key: "fecha",
      label: "Rango de fechas",
      kind: "daterange",
      getDate: (it) => toDate(it.fecha),
    },
  ];

  // ===== filtros: OBSERVACIONES =====
  type ObsFilters = { fecha?: DateRange; order: SortDir };
  const [obsFilters, setObsFilters] = React.useState<ObsFilters>({ order: "desc" });
  const setObsFilter = (key: keyof ObsFilters, value: any) =>
    setObsFilters((s) => ({ ...s, [key]: value }));

  // solo daterange en FiltersBar (sacamos "order")
  const obsFields: FilterField<ObservacionCliente>[] = [
    {
      key: "fecha",
      label: "Rango de fechas",
      kind: "daterange",
      getDate: (o) => toDate(o.fecha),
    },
  ];

  // ===== efectos =====
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

  // ===== colecciones filtradas + ordenadas (memo) =====
  const itemsFilteredSorted = React.useMemo(() => {
    const arr = items.filter((it) => inRange(tsToMillis(it.fecha), preFilters.fecha));
    const dir = preFilters.order === "desc" ? -1 : 1;
    return arr.sort((a, b) => (tsToMillis(a.fecha) - tsToMillis(b.fecha)) * dir);
  }, [items, preFilters]);

  const obsFilteredSorted = React.useMemo(() => {
    const arr = obsCliente.filter((o) => inRange(tsToMillis(o.fecha), obsFilters.fecha));
    const dir = obsFilters.order === "desc" ? -1 : 1;
    return arr.sort((a, b) => (tsToMillis(a.fecha) - tsToMillis(b.fecha)) * dir);
  }, [obsCliente, obsFilters]);

  // ===== handlers =====
  const onSaveWithDestino = async (
    destino: DestinoColeccion,
    data: Omit<Seguimiento, "id">,
    archivo?: File,
    reemplazar?: boolean
  ) => {
    if (!clienteId || !deudorId) return;
    if (!canEditSafe) {
      toast.error("No tienes permiso para crear/editar seguimientos.");
      return;
    }

    try {
      if (seleccionado?.id) {
        // Editar (pre-jurídico)
        if (destino === "seguimientoJuridico") {
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

      // refrescar pre-jurídico (el memo aplica filtros/orden)
      setItems(await getSeguimientos(clienteId, deudorId));
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar el seguimiento.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!clienteId || !deudorId || !deleteId) return;

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
    } catch (e) {
      console.error(e);
      toast.error("No se pudo agregar la observación.");
    }
  };

  // ===== guard UI =====
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

  // ===== render con Tabs + Filters (orden inline) =====
  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate(-1)}>
        ← Volver
      </Button>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="pre">Pre-jurídico</TabsTrigger>
          <TabsTrigger value="juridico">Jurídico</TabsTrigger>
          <TabsTrigger value="obs">Observaciones del cliente</TabsTrigger>
        </TabsList>

        {/* ====== TAB: PRE-JURÍDICO ====== */}
        <TabsContent value="pre" className="mt-6 space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Seguimiento Pre-Jurídico</h2>

              {/* Orden inline – controlado y seguro */}
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

            {/* Filtros Pre-jurídico (solo rango de fechas) */}
            <FiltersBar
              fields={preFields}
              filtersState={preFilters as Record<string, any>}
              setFilter={(k, v) => setPreFilter(k as keyof typeof preFilters, v)}
              onReset={() => setPreFilters({ order: "desc", fecha: undefined })}
            />
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : itemsFilteredSorted.length === 0 ? (
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
                  {canEditSafe && (
                    <TableHead className="w-[160px] text-right">Acciones</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsFilteredSorted.map((seg) => (
                  <TableRow key={seg.id}>
                    <TableCell>
                      {seg.fecha && typeof (seg.fecha as any).toDate === "function"
                        ? (seg.fecha as any).toDate().toLocaleDateString("es-CO")
                        : "—"}
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
            tipificacionDeuda={undefined}
            onSaveWithDestino={onSaveWithDestino}
            destinoInicial="seguimiento"
          />

          {/* Confirmación eliminación */}
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
        </TabsContent>

        {/* ====== TAB: JURÍDICO ====== */}
        <TabsContent value="juridico" className="mt-6">
          <SeguimientoJuridicoTable key={refreshJuridicoKey} />
        </TabsContent>

        {/* ====== TAB: OBSERVACIONES DEL CLIENTE ====== */}
        <TabsContent value="obs" className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">Observaciones</h3>

            {/* Orden inline – controlado y seguro */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Ordenar:</span>
              <Select
                value={obsFilters.order}
                onValueChange={(v) => setObsFilter("order", (v as SortDir) || "desc")}
              >
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Orden" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Más reciente → más antigua</SelectItem>
                  <SelectItem value="asc">Más antigua → más reciente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filtros Observaciones (solo rango de fechas) */}
          <FiltersBar
            fields={obsFields}
            filtersState={obsFilters as Record<string, any>}
            setFilter={(k, v) => setObsFilter(k as keyof typeof obsFilters, v)}
            onReset={() => setObsFilters({ order: "desc", fecha: undefined })}
          />

          <Card className="mt-2">
            <CardHeader>
              <CardTitle>Observaciones del cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {obsLoading ? (
                <p className="text-sm text-muted-foreground">Cargando…</p>
              ) : obsFilteredSorted.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay observaciones del cliente.</p>
              ) : (
                <div className="space-y-3">
                  {obsFilteredSorted.map((o) => {
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
