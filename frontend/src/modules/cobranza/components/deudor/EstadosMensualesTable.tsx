// src/modules/deudores/components/EstadosMensualesTable.tsx
import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowDownUp,
  ArrowUp,
  ArrowDown,
  Calendar,
  DollarSign,
  Edit,
  FileText,
  Filter,
  Percent,
  Plus,
  TrendingUp,
  Save,
  Trash2,
  X,
} from "lucide-react";

import {
  obtenerEstadosMensuales,
  upsertEstadoMensualPorMes,
  eliminarEstadoMensual,
} from "../../services/estadoMensualService";
import { EstadoMensual, ModoHonorariosRecaudo } from "../../models/estadoMensual.model";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Textarea } from "@/shared/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import AppBreadcrumb from "@/shared/components/app-breadcrumb";
import { getClienteById } from "@/modules/clientes/services/clienteService";
import { getDeudorById } from "@/modules/cobranza/services/deudorService";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";
import { useUnsavedChanges } from "@/shared/hooks/useUnsavedChanges";

/* ─── Tipos internos ─── */
interface Filtros {
  mesDesde: string;
  mesHasta: string;
  recibo: string;
  observaciones: string;
  soloConRecaudo: boolean;
}

const FILTROS_VACÍOS: Filtros = {
  mesDesde: "",
  mesHasta: "",
  recibo: "",
  observaciones: "",
  soloConRecaudo: false,
};

function contarFiltrosActivos(f: Filtros) {
  return (
    (f.mesDesde ? 1 : 0) +
    (f.mesHasta ? 1 : 0) +
    (f.recibo ? 1 : 0) +
    (f.observaciones ? 1 : 0) +
    (f.soloConRecaudo ? 1 : 0)
  );
}

function aplicarFiltros(items: EstadoMensual[], f: Filtros): EstadoMensual[] {
  return items.filter((e) => {
    if (f.mesDesde && e.mes < f.mesDesde) return false;
    if (f.mesHasta && e.mes > f.mesHasta) return false;
    if (f.recibo && !String(e.recibo ?? "").toLowerCase().includes(f.recibo.toLowerCase())) return false;
    if (f.observaciones && !String(e.observaciones ?? "").toLowerCase().includes(f.observaciones.toLowerCase())) return false;
    if (f.soloConRecaudo && !(Number(e.recaudo) > 0)) return false;
    return true;
  });
}

/* ─── Formato de moneda en los inputs ─── */
/** Muestra el número con separador de miles; vacío si no hay valor. */
const formatMiles = (n?: number | null) =>
  n == null || Number.isNaN(n) ? "" : Math.trunc(n).toLocaleString();

/** Deja solo los dígitos de lo digitado y lo vuelve número (o undefined). */
const parseMiles = (texto: string): number | undefined => {
  const digitos = texto.replace(/\D/g, "");
  if (!digitos) return undefined;
  return Math.min(Number(digitos), 1e15);
};

/* ─── Honorarios del recaudo: 3 formas de calcularlo ─── */
const fmtPct = (p: number) => String(Number((p ?? 0).toFixed(2)));

const MODOS_HONORARIOS: Array<{
  value: ModoHonorariosRecaudo;
  titulo: string;
  frase: (pct: number) => string;
}> = [
  {
    value: "porcentaje_recaudo",
    titulo: "% sobre el total del recaudo",
    frase: (p) =>
      `Se cobra el ${fmtPct(p)}% del valor total del recaudo. Hon. Recaudo = Recaudo × ${fmtPct(p)}%.`,
  },
  {
    value: "incluido_en_recaudo",
    titulo: "El recaudo ya incluye los honorarios",
    frase: (p) =>
      `El ${fmtPct(p)}% se cobra solo sobre el capital. Hon. Recaudo = Recaudo × ${fmtPct(p)} ÷ ${fmtPct(100 + p)}.`,
  },
  {
    value: "fijo",
    titulo: "Valor fijo (sin porcentaje)",
    frase: () =>
      "No se aplica ningún porcentaje.",
  },
];

const MODO_HONORARIOS_POR_VALOR = Object.fromEntries(
  MODOS_HONORARIOS.map((m) => [m.value, m])
) as Record<ModoHonorariosRecaudo, (typeof MODOS_HONORARIOS)[number]>;

/** Calcula los honorarios del recaudo según el modo elegido. */
function calcularHonorariosRecaudo(
  recaudo: number | null | undefined,
  pct: number | null | undefined,
  modo: ModoHonorariosRecaudo,
  valorFijo: number | null | undefined
): number | undefined {
  if (modo === "fijo") {
    return valorFijo != null ? Math.round(Number(valorFijo)) : undefined;
  }
  const r = Number(recaudo ?? 0);
  if (!(r > 0)) return undefined;
  const p = Number(pct ?? 0);
  return modo === "incluido_en_recaudo"
    ? Math.round(r * (p / (100 + p)))
    : Math.round(r * (p / 100));
}

/** Registros anteriores no traen el modo: se deduce del valor guardado. */
function inferirModoHonorarios(estado: EstadoMensual): ModoHonorariosRecaudo {
  if (estado.modoHonorariosRecaudo) return estado.modoHonorariosRecaudo;
  const r = Number(estado.recaudo ?? 0);
  const hr = estado.honorariosRecaudo;
  if (!(r > 0) || hr == null) return "porcentaje_recaudo";
  const p = Number(estado.porcentajeHonorarios ?? 0);
  const coincideSobreRecaudo = Math.abs(Number(hr) - Math.round(r * (p / 100))) <= 1;
  const coincideIncluido = Math.abs(Number(hr) - Math.round(r * (p / (100 + p)))) <= 1;
  if (coincideSobreRecaudo) return "porcentaje_recaudo";
  if (coincideIncluido) return "incluido_en_recaudo";
  return "fijo";
}

/* ─── Componente ─── */
export default function EstadosMensualesTable() {
  const { clienteId, deudorId } = useParams();
  const navigate = useNavigate();
  const savedDeudoresFilter = sessionStorage.getItem(`deudores_filter_${clienteId}`) ?? "";
  const deudoresHref = `/deudores/${clienteId}${savedDeudoresFilter ? `?${savedDeudoresFilter}` : ""}`;

  // Nombres para el breadcrumb
  const [nombreCliente, setNombreCliente] = React.useState<string>("");
  const [nombreDeudor, setNombreDeudor] = React.useState<string>("");
  const [ubicacionDeudor, setUbicacionDeudor] = React.useState<string>("");

  const TIPIFICACIONES_DEMANDA = new Set<TipificacionDeuda>([
    TipificacionDeuda.DEMANDA,
    TipificacionDeuda.DEMANDA_ACUERDO,
    TipificacionDeuda.DEMANDA_TERMINADO,
    TipificacionDeuda.DEMANDA_INSOLVENCIA,
  ]);
  const [porcentajeDefault, setPorcentajeDefault] = React.useState(15);

  // Datos
  const [estadosMensuales, setEstadosMensuales] = React.useState<EstadoMensual[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Filtros
  const [filtros, setFiltros] = React.useState<Filtros>(FILTROS_VACÍOS);
  const [filtrosAbiertos, setFiltrosAbiertos] = React.useState(false);
  const [ordenDesc, setOrdenDesc] = React.useState(true);

  // Modal & guardado
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Modo edición
  const [editing, setEditing] = React.useState(false);

  // Eliminación
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [estadoToDelete, setEstadoToDelete] = React.useState<EstadoMensual | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const hoyYYYYMM = new Date().toISOString().slice(0, 7);
  const round0 = (n: number) => Math.round(n);

  const [nuevoEstadoMensual, setNuevoEstadoMensual] =
    React.useState<Partial<EstadoMensual>>({
      mes: hoyYYYYMM,
      clienteUID: clienteId || "",
      deuda: undefined,
      recaudo: undefined,
      porcentajeHonorarios: 15,
      honorariosDeuda: undefined,
      honorariosRecaudo: undefined,
      modoHonorariosRecaudo: "porcentaje_recaudo",
      recibo: "",
      observaciones: "",
    });

  const modoHonorarios: ModoHonorariosRecaudo =
    nuevoEstadoMensual.modoHonorariosRecaudo ?? "porcentaje_recaudo";

  useUnsavedChanges(open);

  // Calcular honorarios automáticamente
  React.useEffect(() => {
    setNuevoEstadoMensual((s) => {
      const pctNumber = s.porcentajeHonorarios ?? 15;
      const deudaVal = s.deuda ?? undefined;
      const modo = s.modoHonorariosRecaudo ?? "porcentaje_recaudo";
      // Hon. Deuda siempre es el % sobre la deuda
      const hd = deudaVal != null ? round0(deudaVal * (pctNumber / 100)) : undefined;
      // Hon. Recaudo depende del modo elegido (en "fijo" se respeta lo digitado)
      const hr = calcularHonorariosRecaudo(
        s.recaudo,
        pctNumber,
        modo,
        s.honorariosRecaudo
      );
      if (hd === s.honorariosDeuda && hr === s.honorariosRecaudo) return s;
      return { ...s, honorariosDeuda: hd, honorariosRecaudo: hr };
    });
  }, [
    nuevoEstadoMensual.deuda,
    nuevoEstadoMensual.recaudo,
    nuevoEstadoMensual.porcentajeHonorarios,
    nuevoEstadoMensual.modoHonorariosRecaudo,
  ]);

  const { can, roles = [], loading: aclLoading } = useAcl();

  const esDeudor = roles.includes("deudor");
  const canView = esDeudor ? true : can(PERMS.Abonos_Read);
  const canEdit = !esDeudor && can(PERMS.Abonos_Edit) && !roles.includes("cliente");

  // Cargar estados mensuales
  const cargarEstadosMensuales = async () => {
    if (!clienteId || !deudorId) return;
    setLoading(true);
    try {
      const data = await obtenerEstadosMensuales(clienteId, deudorId);
      setEstadosMensuales(data);
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar los estados mensuales");
    } finally {
      setLoading(false);
    }
  };

  // Cargar nombres para el breadcrumb
  React.useEffect(() => {
    if (!clienteId || !deudorId) return;
    const fetchNames = async () => {
      try {
        const [cliente, deudor] = await Promise.all([
          getClienteById(clienteId),
          getDeudorById(clienteId, deudorId),
        ]);
        setNombreCliente(cliente?.nombre ?? "Cliente");
        setNombreDeudor(deudor?.nombre ?? "Deudor");
        setUbicacionDeudor(deudor?.ubicacion?.trim() ?? "");

        const pct = deudor?.tipificacion && TIPIFICACIONES_DEMANDA.has(deudor.tipificacion) ? 20 : 15;
        setPorcentajeDefault(pct);
        setNuevoEstadoMensual((prev) => ({ ...prev, porcentajeHonorarios: pct }));
      } catch (error) {
        console.error("Error cargando nombres:", error);
      }
    };
    fetchNames();
  }, [clienteId, deudorId]);

  React.useEffect(() => {
    cargarEstadosMensuales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, deudorId]);

  const resetForm = () => {
    setNuevoEstadoMensual({
      mes: new Date().toISOString().slice(0, 7),
      clienteUID: clienteId || "",
      deuda: undefined,
      recaudo: undefined,
      porcentajeHonorarios: porcentajeDefault,
      honorariosDeuda: undefined,
      honorariosRecaudo: undefined,
      modoHonorariosRecaudo: "porcentaje_recaudo",
      recibo: "",
      observaciones: "",
    });
    setEditing(false);
  };

  const openEdit = (estado: EstadoMensual) => {
    if (!canEdit) return;
    setNuevoEstadoMensual({
      clienteUID: clienteId || "",
      id: estado.id,
      mes: estado.mes,
      deuda: estado.deuda ?? undefined,
      recaudo: estado.recaudo ?? undefined,
      porcentajeHonorarios: estado.porcentajeHonorarios ?? 15,
      honorariosDeuda: estado.honorariosDeuda ?? undefined,
      honorariosRecaudo: estado.honorariosRecaudo ?? undefined,
      modoHonorariosRecaudo: inferirModoHonorarios(estado),
      recibo: estado.recibo ?? "",
      observaciones: estado.observaciones ?? "",
    });
    setEditing(true);
    setOpen(true);
  };

  const handleCrearOEditar = async () => {
    if (!canEdit) return toast.error("Sin permiso para guardar.");
    if (!clienteId || !deudorId || !nuevoEstadoMensual.mes) {
      return toast.error("Debe seleccionar el mes.");
    }
    try {
      setSaving(true);
      const pctNumber = nuevoEstadoMensual.porcentajeHonorarios ?? 15;
      const deuda = nuevoEstadoMensual.deuda != null ? Math.round(nuevoEstadoMensual.deuda) : undefined;
      const recaudo = nuevoEstadoMensual.recaudo != null ? Math.round(nuevoEstadoMensual.recaudo) : undefined;
      const payload: Partial<EstadoMensual> = {
        ...nuevoEstadoMensual,
        deuda,
        recaudo,
        honorariosDeuda: deuda != null ? Math.round(deuda * (pctNumber / 100)) : undefined,
        honorariosRecaudo: calcularHonorariosRecaudo(
          recaudo,
          pctNumber,
          modoHonorarios,
          nuevoEstadoMensual.honorariosRecaudo
        ),
        modoHonorariosRecaudo: modoHonorarios,
      };
      await upsertEstadoMensualPorMes(clienteId, deudorId, payload);
      toast.success(editing ? "Estado mensual actualizado" : "Estado mensual guardado");
      await cargarEstadosMensuales();
      setOpen(false);
      resetForm();
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar el estado mensual");
    } finally {
      setSaving(false);
    }
  };

  const handleEliminarEstado = async () => {
    if (!clienteId || !deudorId || !estadoToDelete?.id) return;
    try {
      setDeleting(true);
      await eliminarEstadoMensual(clienteId, deudorId, estadoToDelete.id);
      toast.success("Estado mensual eliminado");
      await cargarEstadosMensuales();
      setEstadoToDelete(null);
      setDeleteDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Error al eliminar el estado mensual");
    } finally {
      setDeleting(false);
    }
  };

  const estadosFiltrados = React.useMemo(() => {
    const filtrados = aplicarFiltros(estadosMensuales, filtros);
    return [...filtrados].sort((a, b) =>
      ordenDesc ? b.mes.localeCompare(a.mes) : a.mes.localeCompare(b.mes)
    );
  }, [estadosMensuales, filtros, ordenDesc]);
  const filtrosActivos = contarFiltrosActivos(filtros);

  if (aclLoading) {
    return (
      <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-3" />
        <Typography variant="small">Cargando permisos...</Typography>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
        <Typography variant="body">No tienes acceso a Abonos.</Typography>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
        <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-3" />
        <Typography variant="small">Cargando estados mensuales...</Typography>
      </div>
    );
  }

  const deudorLabel = `${nombreDeudor}${ubicacionDeudor ? ` - ${ubicacionDeudor}` : ""}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">

        {/* HEADER */}
        <header className="space-y-4">
          <div className="flex items-center gap-2">
            <AppBreadcrumb
              items={[
                ...(!esDeudor ? [{ label: "Clientes", href: "/clientes-tables" }] : []),
                { label: nombreCliente, href: esDeudor ? `/clientes/${clienteId}/deudores/${deudorId}` : deudoresHref },
                ...(!esDeudor ? [{ label: deudorLabel, href: `/clientes/${clienteId}/deudores/${deudorId}` }] : []),
                { label: "Estados Mensuales" },
              ]}
            />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-brand-primary/10">
                <TrendingUp className="h-6 w-6 text-brand-primary" />
              </div>
              <div>
                <Typography variant="h2" className="!text-brand-secondary">
                  Estados Mensuales del Deudor
                </Typography>
                <Typography variant="small" className="mt-0.5">
                  Seguimiento de deuda, recaudos y honorarios
                </Typography>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Botón filtros */}
              <Button
                variant="outline"
                onClick={() => setFiltrosAbiertos((v) => !v)}
                className={cn(
                  "gap-2 border-brand-secondary/30 relative",
                  filtrosActivos > 0 && "border-brand-primary text-brand-primary bg-brand-primary/5"
                )}
              >
                <Filter className="h-4 w-4" />
                Filtrar
                {filtrosActivos > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-brand-primary text-white text-[10px] font-bold flex items-center justify-center">
                    {filtrosActivos}
                  </span>
                )}
              </Button>

              {canEdit && (
                <Dialog
                  open={open}
                  onOpenChange={(v) => {
                    setOpen(v);
                    if (!v) resetForm();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        resetForm();
                        setOpen(true);
                      }}
                      variant="brand"
                      className="gap-2 shadow-md hover:shadow-lg transition-all"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar estado mensual
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-brand-primary text-xl font-bold flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {editing
                          ? `Editar Estado (${nuevoEstadoMensual.mes})`
                          : "Nuevo Estado Mensual"}
                      </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                      {/* Mes */}
                      <div className="space-y-2">
                        <Label htmlFor="mes" className="text-brand-secondary font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Mes *
                        </Label>
                        <Input
                          id="mes"
                          type="month"
                          value={nuevoEstadoMensual.mes || ""}
                          onChange={(e) =>
                            setNuevoEstadoMensual((s) => ({ ...s, mes: e.target.value }))
                          }
                          className="border-brand-secondary/30"
                        />
                      </div>

                      {/* Campos numéricos */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="deuda" className="text-brand-secondary font-medium flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Deuda
                          </Label>
                          <Input
                            id="deuda"
                            type="text"
                            inputMode="numeric"
                            value={formatMiles(nuevoEstadoMensual.deuda)}
                            onChange={(e) =>
                              setNuevoEstadoMensual((s) => ({
                                ...s,
                                deuda: parseMiles(e.target.value),
                              }))
                            }
                            placeholder="0"
                            className="border-brand-secondary/30"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="recaudo" className="text-brand-secondary font-medium flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Recaudo
                          </Label>
                          <Input
                            id="recaudo"
                            type="text"
                            inputMode="numeric"
                            value={formatMiles(nuevoEstadoMensual.recaudo)}
                            onChange={(e) =>
                              setNuevoEstadoMensual((s) => ({
                                ...s,
                                recaudo: parseMiles(e.target.value),
                              }))
                            }
                            placeholder="0"
                            className="border-brand-secondary/30"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="porcentaje" className="text-brand-secondary font-medium flex items-center gap-2">
                            <Percent className="h-4 w-4" />
                            % Honorarios
                          </Label>
                          <Input
                            id="porcentaje"
                            type="number"
                            step="0.01"
                            value={nuevoEstadoMensual.porcentajeHonorarios ?? ""}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            onChange={(e) => {
                              const val = e.target.value ? parseFloat(e.target.value) : undefined;
                              setNuevoEstadoMensual((s) => ({ ...s, porcentajeHonorarios: val }));
                            }}
                            placeholder="15"
                            className="border-brand-secondary/30"
                          />
                        </div>
                      </div>

                      {/* Honorarios */}
                      <div className="rounded-xl border border-brand-secondary/20 bg-brand-primary/5 p-4 space-y-4">
                        <div className="space-y-2">
                          <Label className="text-brand-secondary font-medium">
                            Forma de cálculo de los honorarios
                          </Label>
                          <Select
                            value={modoHonorarios}
                            onValueChange={(v) =>
                              setNuevoEstadoMensual((s) => ({
                                ...s,
                                modoHonorariosRecaudo: v as ModoHonorariosRecaudo,
                              }))
                            }
                          >
                            <SelectTrigger className="w-full bg-white border-brand-secondary/30">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MODOS_HONORARIOS.map((m) => (
                                <SelectItem key={m.value} value={m.value}>
                                  {m.titulo}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Typography variant="small" className="text-brand-secondary/70 leading-snug">
                            {MODO_HONORARIOS_POR_VALOR[modoHonorarios].frase(
                              nuevoEstadoMensual.porcentajeHonorarios ?? 0
                            )}
                          </Typography>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-brand-secondary font-medium">Hon. Deuda</Label>
                            <Input
                              readOnly
                              value={nuevoEstadoMensual.honorariosDeuda != null
                                ? `$${nuevoEstadoMensual.honorariosDeuda.toLocaleString()}`
                                : ""}
                              className="bg-white border-brand-secondary/30 cursor-not-allowed"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="honorariosRecaudo" className="text-brand-secondary font-medium">
                              Hon. Recaudo{" "}
                              <span className="text-xs font-normal text-brand-secondary/60">
                                {modoHonorarios === "fijo" ? "(valor fijo)" : "(calculado)"}
                              </span>
                            </Label>
                            {modoHonorarios === "fijo" ? (
                              <Input
                                id="honorariosRecaudo"
                                type="text"
                                inputMode="numeric"
                                value={formatMiles(nuevoEstadoMensual.honorariosRecaudo)}
                                onChange={(e) =>
                                  setNuevoEstadoMensual((s) => ({
                                    ...s,
                                    honorariosRecaudo: parseMiles(e.target.value),
                                  }))
                                }
                                placeholder="0"
                                className="bg-white border-brand-secondary/30"
                              />
                            ) : (
                              <Input
                                readOnly
                                value={nuevoEstadoMensual.honorariosRecaudo != null
                                  ? `$${nuevoEstadoMensual.honorariosRecaudo.toLocaleString()}`
                                  : ""}
                                className="bg-white border-brand-secondary/30 cursor-not-allowed"
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Recibo */}
                      <div className="space-y-2">
                        <Label htmlFor="recibo" className="text-brand-secondary font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Número de Recibo
                        </Label>
                        <Input
                          id="recibo"
                          value={nuevoEstadoMensual.recibo ?? ""}
                          onChange={(e) =>
                            setNuevoEstadoMensual((s) => ({ ...s, recibo: e.target.value }))
                          }
                          placeholder="Ej: REC-2024-001"
                          className="border-brand-secondary/30"
                        />
                      </div>

                      {/* Observaciones */}
                      <div className="space-y-2">
                        <Label htmlFor="observaciones" className="text-brand-secondary font-medium">
                          Observaciones
                        </Label>
                        <Textarea
                          id="observaciones"
                          value={nuevoEstadoMensual.observaciones ?? ""}
                          onChange={(e) =>
                            setNuevoEstadoMensual((s) => ({ ...s, observaciones: e.target.value }))
                          }
                          placeholder="Notas adicionales sobre este estado mensual..."
                          className="min-h-24 border-brand-secondary/30"
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => { setOpen(false); resetForm(); }}
                        disabled={saving}
                        className="border-brand-secondary/30"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleCrearOEditar}
                        disabled={saving}
                        variant="brand"
                        className="gap-2"
                      >
                        {saving ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            {editing ? "Actualizar" : "Guardar"}
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </header>

        {/* PANEL DE FILTROS */}
        {filtrosAbiertos && (
          <div className="rounded-2xl border border-brand-primary/20 bg-white shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-brand-primary" />
                <span className="font-semibold text-brand-secondary text-sm">Filtros</span>
                {filtrosActivos > 0 && (
                  <span className="text-xs text-brand-primary font-medium">
                    ({filtrosActivos} activo{filtrosActivos > 1 ? "s" : ""})
                  </span>
                )}
              </div>
              {filtrosActivos > 0 && (
                <button
                  onClick={() => setFiltros(FILTROS_VACÍOS)}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Limpiar filtros
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Mes desde */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-brand-secondary flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Mes desde
                </Label>
                <Input
                  type="month"
                  value={filtros.mesDesde}
                  onChange={(e) => setFiltros((f) => ({ ...f, mesDesde: e.target.value }))}
                  className="h-9 text-sm border-brand-secondary/30"
                />
              </div>

              {/* Mes hasta */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-brand-secondary flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Mes hasta
                </Label>
                <Input
                  type="month"
                  value={filtros.mesHasta}
                  onChange={(e) => setFiltros((f) => ({ ...f, mesHasta: e.target.value }))}
                  className="h-9 text-sm border-brand-secondary/30"
                />
              </div>

              {/* Recibo */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-brand-secondary flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Número de recibo
                </Label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Buscar recibo..."
                    value={filtros.recibo}
                    onChange={(e) => setFiltros((f) => ({ ...f, recibo: e.target.value }))}
                    className="h-9 text-sm border-brand-secondary/30 pr-7"
                  />
                  {filtros.recibo && (
                    <button
                      onClick={() => setFiltros((f) => ({ ...f, recibo: "" }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Observaciones */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-brand-secondary">
                  Observaciones
                </Label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Buscar en observaciones..."
                    value={filtros.observaciones}
                    onChange={(e) => setFiltros((f) => ({ ...f, observaciones: e.target.value }))}
                    className="h-9 text-sm border-brand-secondary/30 pr-7"
                  />
                  {filtros.observaciones && (
                    <button
                      onClick={() => setFiltros((f) => ({ ...f, observaciones: "" }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Toggle solo con recaudo */}
            <div className="flex items-center gap-3 pt-1">
              <button
                role="switch"
                aria-checked={filtros.soloConRecaudo}
                onClick={() => setFiltros((f) => ({ ...f, soloConRecaudo: !f.soloConRecaudo }))}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                  filtros.soloConRecaudo ? "bg-brand-primary" : "bg-gray-200"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform",
                    filtros.soloConRecaudo ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
              <label
                className="text-sm text-brand-secondary cursor-pointer select-none"
                onClick={() => setFiltros((f) => ({ ...f, soloConRecaudo: !f.soloConRecaudo }))}
              >
                Solo meses con recaudo
              </label>
            </div>

            {/* Resumen */}
            {filtrosActivos > 0 && (
              <div className="text-xs text-brand-secondary/60 pt-1 border-t border-brand-secondary/10">
                Mostrando <strong className="text-brand-primary">{estadosFiltrados.length}</strong> de{" "}
                <strong>{estadosMensuales.length}</strong> registros
              </div>
            )}
          </div>
        )}

        {/* Tabla */}
        {estadosMensuales.length === 0 ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-brand-primary/10">
                <TrendingUp className="h-8 w-8 text-brand-primary/60" />
              </div>
              <Typography variant="h3" className="text-brand-secondary">
                No hay registros
              </Typography>
              <Typography variant="small">
                Aún no se han registrado estados mensuales
              </Typography>
            </div>
          </div>
        ) : estadosFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-amber-50">
                <Filter className="h-8 w-8 text-amber-400" />
              </div>
              <Typography variant="h3" className="text-brand-secondary">
                Sin resultados
              </Typography>
              <Typography variant="small">
                Ningún registro coincide con los filtros aplicados
              </Typography>
              <button
                onClick={() => setFiltros(FILTROS_VACÍOS)}
                className="text-sm text-brand-primary hover:underline font-medium"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="text-brand-secondary font-semibold">
                      <button
                        onClick={() => setOrdenDesc((v) => !v)}
                        className="flex items-center gap-1.5 hover:text-brand-primary transition-colors group"
                      >
                        Mes
                        {ordenDesc
                          ? <ArrowDown className="h-3.5 w-3.5 text-brand-primary" />
                          : <ArrowUp className="h-3.5 w-3.5 text-brand-primary" />
                        }
                      </button>
                    </TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Deuda</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Recaudo</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">% Honorarios</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Hon. Deuda</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Hon. Recaudo</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Total con Honorarios</TableHead>
                    {canEdit && (
                      <TableHead className="text-center text-brand-secondary font-semibold">
                        Acciones
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estadosFiltrados.map((estado, index) => (
                    <TableRow
                      key={estado.id ?? `${estado.mes}`}
                      className={cn(
                        "border-brand-secondary/5 transition-colors",
                        index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]",
                        "hover:bg-brand-primary/5"
                      )}
                    >
                      <TableCell className="font-medium text-brand-secondary">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {estado.mes}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-700">
                        ${Number(estado.deuda ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        ${Number(estado.recaudo ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {Number(estado.porcentajeHonorarios ?? 0).toLocaleString()}%
                      </TableCell>
                      <TableCell className="text-gray-700">
                        ${Number(estado.honorariosDeuda ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        ${Number(estado.honorariosRecaudo ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-gray-700 font-semibold">
                        ${(Number(estado.deuda ?? 0) + Number(estado.honorariosDeuda ?? 0)).toLocaleString()}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEdit(estado)}
                              className="hover:bg-brand-primary/10"
                            >
                              <Edit className="h-4 w-4 text-brand-primary" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEstadoToDelete(estado);
                                setDeleteDialogOpen(true);
                              }}
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

        {/* Dialog confirmación eliminación */}
        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={(v) => {
            setDeleteDialogOpen(v);
            if (!v) setEstadoToDelete(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar estado mensual</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que deseas eliminar el estado mensual del mes{" "}
                <strong>{estadoToDelete?.mes}</strong>? Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleEliminarEstado}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </div>
  );
}
