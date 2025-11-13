// modules/cobranza/components/SeguimientoTable.tsx
import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  FileText,
  History,
  MessageSquare,
  Scale,
  Gavel,
  Plus,
  Edit,
  Trash2,
  Download,
  Filter as FilterIcon,
} from "lucide-react";

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

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";

import FiltersBar from "@/shared/table-filters/FiltersBar";
import type { DateRange, FilterField } from "@/shared/table-filters/types";

import { codeToLabel } from "@/shared/constants/tipoSeguimiento";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/shared/ui/select";
import SeguimientoDemandaTable from "./SeguimientoDemandaTable";
import { Typography } from "@/shared/design-system/components/Typography";
import { BackButton } from "@/shared/design-system/components/BackButton";
import { cn } from "@/shared/lib/cn";

type SortDir = "desc" | "asc";

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
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
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

  const [items, setItems] = React.useState<Seguimiento[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [seleccionado, setSeleccionado] = React.useState<Seguimiento | undefined>(undefined);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const [refreshJuridicoKey, setRefreshJuridicoKey] = React.useState(0);

  const { can, loading: aclLoading, roles = [] } = useAcl();
  const canView = can(PERMS.Seguimientos_Read);
  const canEdit = can(PERMS.Seguimientos_Edit);
  const isCliente = Array.isArray(roles) && roles.includes("cliente");
  const canEditSafe = canEdit && !isCliente;

  const [obsCliente, setObsCliente] = React.useState<ObservacionCliente[]>([]);
  const [obsLoading, setObsLoading] = React.useState(false);
  const [obsTexto, setObsTexto] = React.useState("");
  const auth = getAuth();
  const demandaRef = React.useRef<{ openForm?: () => void } | null>(null);

  const [tab, setTab] = React.useState<"pre" | "juridico" | "demanda" | "obs">("pre");

  type PreFilters = { fecha?: DateRange; order: SortDir };
  const [preFilters, setPreFilters] = React.useState<PreFilters>({ order: "desc" });
  const setPreFilter = (key: keyof PreFilters, value: any) =>
    setPreFilters((s) => ({ ...s, [key]: value }));

  const preFields: FilterField<Seguimiento>[] = [
    { key: "fecha", label: "Rango de fechas", kind: "daterange", getDate: (it) => toDate(it.fecha) },
  ];

  type ObsFilters = { fecha?: DateRange; order: SortDir };
  const [obsFilters, setObsFilters] = React.useState<ObsFilters>({ order: "desc" });
  const setObsFilter = (key: keyof ObsFilters, value: any) =>
    setObsFilters((s) => ({ ...s, [key]: value }));

  const obsFields: FilterField<ObservacionCliente>[] = [
    { key: "fecha", label: "Rango de fechas", kind: "daterange", getDate: (o) => toDate(o.fecha) },
  ];

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
      const uidUsuario = auth.currentUser?.uid;
      if (!uidUsuario) {
        toast.error("No se pudo obtener el usuario autenticado.");
        return;
      }
      if (seleccionado?.id) {
        if (destino === "seguimientoJuridico") {
          await addSeguimientoJuridico(uidUsuario, clienteId, deudorId, data, archivo);
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
        if (destino === "seguimientoJuridico") {
          await addSeguimientoJuridico(uidUsuario, clienteId, deudorId, data, archivo);
          setRefreshJuridicoKey((k) => k + 1);
        } else {
          await addSeguimiento(uidUsuario, clienteId, deudorId, data, archivo);
        }
      }
      toast.success("✓ Seguimiento guardado correctamente");
      setOpen(false);
      setSeleccionado(undefined);
      setItems(await getSeguimientos(clienteId, deudorId));
    } catch (e) {
      console.error(e);
      toast.error("⚠️ No se pudo guardar el seguimiento");
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
      toast.success("✓ Seguimiento eliminado");
    } catch {
      toast.error("⚠️ No se pudo eliminar el seguimiento");
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
      await addObservacionCliente(clienteId, deudorId, texto);
      setObsTexto("");
      setObsCliente(await getObservacionesCliente(clienteId, deudorId));
      toast.success("✓ Observación agregada");
    } catch (e) {
      console.error(e);
      toast.error("⚠️ No se pudo agregar la observación");
    }
  };

  if (aclLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-4" />
          <Typography variant="body" className="text-muted">
            Cargando permisos...
          </Typography>
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <Typography variant="h2" className="text-brand-secondary mb-2">
            Acceso denegado
          </Typography>
          <Typography variant="body" className="text-muted mb-4">
            No tienes permisos para ver seguimientos.
          </Typography>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Volver
          </Button>
        </div>
      </div>
    );
  }

  // Tab icons
  const tabIcons = {
    pre: History,
    juridico: Scale,
    demanda: Gavel,
    obs: MessageSquare,
  };

  const TabIcon = tabIcons[tab];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        
        {/* HEADER */}
        <header className="space-y-4">
          <div className="flex items-center gap-2">
            <BackButton 
              variant="ghost" 
              size="sm"
              className="text-brand-secondary hover:text-brand-primary hover:bg-brand-primary/5 transition-all"
            />

          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-primary/10">
                <TabIcon className="h-6 w-6 text-brand-primary" />
              </div>
              <div>
                <Typography variant="h2" className="!text-brand-primary font-bold">
                  Gestión de Seguimiento
                </Typography>
                <Typography variant="small" className="text-muted mt-0.5">
                  {tab === "pre" && "Seguimiento pre-jurídico"}
                  {tab === "juridico" && "Seguimiento jurídico"}
                  {tab === "demanda" && "Seguimiento de demanda"}
                  {tab === "obs" && "Observaciones del cliente"}
                </Typography>
              </div>
            </div>

            {canEditSafe && (
              (tab === "pre" || tab === "juridico") ? (
                <Button
                  variant="brand"
                  onClick={() => {
                    setSeleccionado(undefined);
                    setOpen(true);
                  }}
                  className="gap-2 shadow-md hover:shadow-lg transition-all"
                >
                  <Plus className="h-4 w-4" />
                  {tab === "juridico" ? "Nuevo seguimiento jurídico" : "Nuevo seguimiento"}
                </Button>
              ) : tab === "demanda" ? (
                <Button
                  variant="brand"
                  onClick={() => demandaRef.current?.openForm?.()}
                  className="gap-2 shadow-md hover:shadow-lg transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo seguimiento (Demanda)
                </Button>
              ) : null
            )}
          </div>
        </header>

        {/* TABS */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
          <TabsList className="grid grid-cols-4 w-full bg-white border border-brand-secondary/20 p-1 rounded-xl">
            <TabsTrigger 
              value="pre"
              className="data-[state=active]:bg-brand-primary data-[state=active]:text-white rounded-lg transition-all"
            >
              <History className="h-4 w-4 mr-2" />
              Ejecutiv@ Pre-jurídico
            </TabsTrigger>
            <TabsTrigger 
              value="juridico"
              className="data-[state=active]:bg-brand-primary data-[state=active]:text-white rounded-lg transition-all"
            >
              <Scale className="h-4 w-4 mr-2" />
              Ejecutiv@ Jurídico
            </TabsTrigger>
            <TabsTrigger 
              value="demanda"
              className="data-[state=active]:bg-brand-primary data-[state=active]:text-white rounded-lg transition-all"
            >
              <Gavel className="h-4 w-4 mr-2" />
              Dependiente(Demanda)
            </TabsTrigger>
            <TabsTrigger 
              value="obs"
              className="data-[state=active]:bg-brand-primary data-[state=active]:text-white rounded-lg transition-all"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Observaciones
            </TabsTrigger>
          </TabsList>

          {/* PRE-JURÍDICO */}
          <TabsContent value="pre" className="mt-6 space-y-4">
            <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
                <div className="flex items-center gap-2">
                  <FilterIcon className="h-5 w-5 text-brand-primary" />
                  <Typography variant="h3" className="!text-brand-secondary font-semibold">
                    Filtros de búsqueda
                  </Typography>
                </div>
              </div>
              <div className="p-4 md:p-5">
                <FiltersBar
                  fields={preFields}
                  filtersState={preFilters as Record<string, any>}
                  setFilter={(k, v) => setPreFilter(k as keyof typeof preFilters, v)}
                  onReset={() => setPreFilters({ order: "desc", fecha: undefined })}
                />
              </div>
            </section>

            {loading ? (
              <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
                  <Typography variant="body" className="text-muted">
                    Cargando seguimientos...
                  </Typography>
                </div>
              </div>
            ) : itemsFilteredSorted.length === 0 ? (
              <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 rounded-full bg-brand-primary/10">
                    <History className="h-8 w-8 text-brand-primary/60" />
                  </div>
                  <Typography variant="h3" className="text-brand-secondary">
                    No hay seguimientos
                  </Typography>
                  <Typography variant="small" className="text-muted">
                    Aún no se han registrado seguimientos pre-jurídicos
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
                      {itemsFilteredSorted.map((seg, index) => (
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
                            <span className="inline-flex items-center rounded-full bg-blue-100 border border-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-700">
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
              tipificacionDeuda={undefined}
              onSaveWithDestino={onSaveWithDestino}
              destinoInicial={tab === "juridico" ? "seguimientoJuridico" : "seguimiento"}
            />

            <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar seguimiento?</AlertDialogTitle>
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

          {/* JURÍDICO */}
          <TabsContent value="juridico" className="mt-6">
            <SeguimientoJuridicoTable key={refreshJuridicoKey} />
          </TabsContent>

          {/* DEMANDA */}
          <TabsContent value="demanda" className="mt-6">
            {(() => {
              const SeguimientoDemandaTableAny = SeguimientoDemandaTable as any;
              return <SeguimientoDemandaTableAny ref={demandaRef} />;
            })()}
          </TabsContent>

          {/* OBSERVACIONES */}
          <TabsContent value="obs" className="mt-6 space-y-4">
            <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Typography variant="h3" className="!text-brand-secondary font-semibold">
                    Observaciones del cliente
                  </Typography>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Ordenar:</span>
                    <Select
                      value={obsFilters.order}
                      onValueChange={(v) => setObsFilter("order", (v as SortDir) || "desc")}
                    >
                      <SelectTrigger className="w-[240px] border-brand-secondary/30">
                        <SelectValue placeholder="Orden" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc">Más reciente primero</SelectItem>
                        <SelectItem value="asc">Más antigua primero</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="p-4 md:p-5">
                <FiltersBar
                  fields={obsFields}
                  filtersState={obsFilters as Record<string, any>}
                  setFilter={(k, v) => setObsFilter(k as keyof typeof obsFilters, v)}
                  onReset={() => setObsFilters({ order: "desc", fecha: undefined })}
                />
              </div>
            </section>

            <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
              <div className="p-4 md:p-5 space-y-4">
                {obsLoading ? (
                  <div className="text-center py-8">
                    <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-3" />
                    <Typography variant="small" className="text-muted">
                      Cargando observaciones...
                    </Typography>
                  </div>
                ) : obsFilteredSorted.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="p-3 rounded-full bg-brand-primary/10 inline-block mb-3">
                      <MessageSquare className="h-6 w-6 text-brand-primary/60" />
                    </div>
                    <Typography variant="body" className="text-muted">
                      No hay observaciones del cliente
                    </Typography>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {obsFilteredSorted.map((o, index) => {
                      const fecha =
                        (o.fecha as any)?.toDate?.() instanceof Date
                          ? (o.fecha as any).toDate().toLocaleString("es-CO", { hour12: false })
                          : "—";
                      return (
                        <div 
                          key={o.id} 
                          className={cn(
                            "rounded-lg border p-4 transition-colors",
                            index % 2 === 0 ? "bg-white border-brand-secondary/20" : "bg-brand-primary/5 border-brand-primary/20"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="h-4 w-4 text-brand-primary" />
                            <span className="text-xs text-muted-foreground font-medium">{fecha}</span>
                          </div>
                          <div className="text-sm whitespace-pre-wrap text-gray-700 leading-relaxed">
                            {o.texto}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {isCliente && (
                  <div className="space-y-3 pt-4 border-t border-brand-secondary/10">
                    <Typography variant="body" className="font-semibold text-brand-secondary">
                      Agregar nueva observación
                    </Typography>
                    <Textarea
                      value={obsTexto}
                      onChange={(e) => setObsTexto(e.target.value)}
                      className="min-h-28 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                      placeholder="Escribe tu observación para el ejecutivo..."
                    />
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleAgregarObservacion}
                        variant="brand"
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Agregar observación
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}