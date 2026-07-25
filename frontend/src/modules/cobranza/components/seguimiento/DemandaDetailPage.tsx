// modules/cobranza/components/seguimiento/DemandaDetailPage.tsx
import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getAuth } from "firebase/auth";
import {
  Gavel,
  Save,
  ArrowLeft,
  Users,
  Building2,
  MapPin,
  Hash,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Tag,
  Bell,
  Edit,
  Download,
  FileText,
  Scale,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/ui/popover";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/shared/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/shared/ui/table";
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import AppBreadcrumb from "@/shared/components/app-breadcrumb";
import { ExpandableCell } from "@/shared/components/expandable-cell";
import { PERMS, type Rol, type Perm } from "@/shared/constants/acl";
import { useAcl } from "@/modules/auth/hooks/useAcl";

import { getClienteById } from "@/modules/clientes/services/clienteService";
import { getDeudorById } from "../../services/deudorService";
import {
  getDemandaById,
  actualizarDemanda,
  actualizarProcesoJudicialDemanda,
} from "../../services/demandaService";
import {
  Demanda,
  DemandadoDemanda,
  EtiquetaEnDemanda,
  NotificacionDemandado,
  toDateSafe,
} from "../../models/demanda.model";
import {
  getEtiquetasDemanda,
} from "../../services/etiquetaDemandaService";
import type { EtiquetaDemanda } from "../../models/etiquetaDemanda.model";
import { TIPOS_NOTIFICACION_DEMANDA } from "@/shared/constants/notificacionDemanda";
import {
  getSeguimientosDemanda,
  addSeguimientoDemanda,
  updateSeguimientoDemanda,
  deleteSeguimientoDemanda,
  type SeguimientoDemanda,
} from "../../services/seguimientoDemandaService";

const fmt = new Intl.DateTimeFormat("es-CO", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function fmtFecha(v: any): string {
  const d = toDateSafe(v);
  return d ? fmt.format(d) : "—";
}

function ymd(v: any): string {
  const d = toDateSafe(v);
  return d ? d.toISOString().slice(0, 10) : "";
}

function parseLocalYmd(s: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

const CPNU_URL =
  "https://us-central1-gestionglobal-9eac8.cloudfunctions.net/helloWorld";

export default function DemandaDetailPage() {
  const { clienteId, deudorId, demandaId } = useParams();
  const navigate = useNavigate();

  const acl = useAcl() as {
    roles: Rol[];
    can: (req: Perm | Perm[]) => boolean;
    loading: boolean;
  };
  const roles = Array.isArray(acl.roles) ? acl.roles : [];
  const isExterno = roles.includes("cliente") || roles.includes("deudor");
  const puedeEditar = acl.can(PERMS.Seguimientos_Dependientes_Edit);
  const readOnly = !puedeEditar;

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [nombreCliente, setNombreCliente] = React.useState("Cliente");
  const [deudorNombre, setDeudorNombre] = React.useState("");

  // ── Datos de la demanda ────────────────────────────────────────
  const [form, setForm] = React.useState({
    numeroRadicado: "",
    juzgado: "",
    localidad: "",
    estado: "activa" as Demanda["estado"],
    demandaSustituto: false,
    fechaUltimaRevision: "",
  });
  const [demandados, setDemandados] = React.useState<DemandadoDemanda[]>([]);
  const [etiquetas, setEtiquetas] = React.useState<EtiquetaEnDemanda[]>([]);
  const [obsInterna, setObsInterna] = React.useState("");
  const [obsCliente, setObsCliente] = React.useState("");
  const [catalogo, setCatalogo] = React.useState<EtiquetaDemanda[]>([]);
  const [procesoJudicial, setProcesoJudicial] = React.useState<any>(null);

  // ── Seguimiento ────────────────────────────────────────────────
  const [segRows, setSegRows] = React.useState<SeguimientoDemanda[]>([]);
  const [segOpen, setSegOpen] = React.useState(false);
  const [segEdit, setSegEdit] = React.useState<SeguimientoDemanda | null>(null);
  const [segFecha, setSegFecha] = React.useState<Date>(() => new Date());
  const [segDescripcion, setSegDescripcion] = React.useState("");
  const [segEsInterno, setSegEsInterno] = React.useState(false);
  const [segArchivo, setSegArchivo] = React.useState<File | undefined>();
  const [segSaving, setSegSaving] = React.useState(false);

  const load = async () => {
    if (!clienteId || !deudorId || !demandaId) return;
    try {
      setLoading(true);
      const [demanda, cliente, deudor, cat, segs] = await Promise.all([
        getDemandaById(clienteId, deudorId, demandaId),
        getClienteById(clienteId),
        getDeudorById(clienteId, deudorId),
        getEtiquetasDemanda(true),
        getSeguimientosDemanda(clienteId, deudorId, demandaId),
      ]);
      if (cliente?.nombre) setNombreCliente(cliente.nombre);
      if (deudor?.nombre) setDeudorNombre(deudor.nombre);
      setCatalogo(cat);
      setSegRows(segs);

      if (!demanda) {
        toast.error("La demanda no existe");
        return;
      }
      setForm({
        numeroRadicado: demanda.numeroRadicado ?? "",
        juzgado: demanda.juzgado ?? "",
        localidad: demanda.localidad ?? "",
        estado: demanda.estado ?? "activa",
        demandaSustituto: !!demanda.demandaSustituto,
        fechaUltimaRevision: ymd(demanda.fechaUltimaRevision),
      });
      setDemandados(
        (demanda.demandados ?? []).map((d) => ({
          nombre: d.nombre ?? "",
          numeroDocumento: d.numeroDocumento ?? "",
          notificaciones: (d.notificaciones ?? []).map((n) => ({
            tipo: n.tipo,
            fecha: n.fecha,
            coteje: !!n.coteje,
          })),
        }))
      );
      setEtiquetas(
        (demanda.etiquetas ?? []).map((e) => ({
          etiquetaId: e.etiquetaId,
          nombre: e.nombre ?? "",
          detalle: e.detalle ?? "",
          fecha: e.fecha,
        }))
      );
      setObsInterna(demanda.observacionesDemanda ?? "");
      setObsCliente(demanda.observacionesDemandaCliente ?? "");
      setProcesoJudicial(demanda.procesoJudicial ?? null);
    } catch {
      toast.error("Error cargando la demanda");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, deudorId, demandaId]);

  // ── Demandados ─────────────────────────────────────────────────
  // Notificaciones colapsadas por defecto; se expande el demandado que se edita.
  const [expandidos, setExpandidos] = React.useState<Set<number>>(new Set());
  const toggleExpandido = (i: number) =>
    setExpandidos((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const addDemandado = () =>
    setDemandados((p) => {
      const next = [...p, { nombre: "", numeroDocumento: "", notificaciones: [] }];
      setExpandidos((prev) => new Set(prev).add(next.length - 1));
      return next;
    });
  const removeDemandado = (i: number) =>
    setDemandados((p) => p.filter((_, idx) => idx !== i));
  const updateDemandado = (i: number, field: "nombre" | "numeroDocumento", v: string) =>
    setDemandados((p) => p.map((d, idx) => (idx === i ? { ...d, [field]: v } : d)));

  const addNotificacion = (di: number) => {
    setExpandidos((prev) => new Set(prev).add(di));
    setDemandados((p) =>
      p.map((d, idx) =>
        idx === di
          ? {
              ...d,
              notificaciones: [
                ...d.notificaciones,
                { tipo: TIPOS_NOTIFICACION_DEMANDA[0].value, fecha: null, coteje: false },
              ],
            }
          : d
      )
    );
  };
  const removeNotificacion = (di: number, ni: number) =>
    setDemandados((p) =>
      p.map((d, idx) =>
        idx === di
          ? { ...d, notificaciones: d.notificaciones.filter((_, k) => k !== ni) }
          : d
      )
    );
  const updateNotificacion = (
    di: number,
    ni: number,
    patch: Partial<NotificacionDemandado>
  ) =>
    setDemandados((p) =>
      p.map((d, idx) =>
        idx === di
          ? {
              ...d,
              notificaciones: d.notificaciones.map((n, k) =>
                k === ni ? { ...n, ...patch } : n
              ),
            }
          : d
      )
    );

  // ── Etiquetas ──────────────────────────────────────────────────
  const addEtiqueta = () =>
    setEtiquetas((p) => [...p, { nombre: "", detalle: "", fecha: null }]);
  const removeEtiqueta = (i: number) =>
    setEtiquetas((p) => p.filter((_, idx) => idx !== i));
  const updateEtiqueta = (i: number, patch: Partial<EtiquetaEnDemanda>) =>
    setEtiquetas((p) => p.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const pickEtiqueta = (i: number, etiquetaId: string) => {
    const cat = catalogo.find((c) => c.id === etiquetaId);
    updateEtiqueta(i, { etiquetaId, nombre: cat?.nombre ?? "" });
  };

  // ── Guardar demanda ────────────────────────────────────────────
  const guardar = async () => {
    if (!clienteId || !deudorId || !demandaId || !puedeEditar) return;
    try {
      setSaving(true);
      await actualizarDemanda(clienteId, deudorId, demandaId, {
        numeroRadicado: form.numeroRadicado,
        juzgado: form.juzgado,
        localidad: form.localidad,
        estado: form.estado,
        demandaSustituto: form.demandaSustituto,
        fechaUltimaRevision: form.fechaUltimaRevision
          ? parseLocalYmd(form.fechaUltimaRevision)
          : null,
        demandados,
        etiquetas,
        observacionesDemanda: obsInterna,
        observacionesDemandaCliente: obsCliente,
      });
      toast.success("✓ Demanda guardada");
    } catch {
      toast.error("⚠️ No se pudo guardar la demanda");
    } finally {
      setSaving(false);
    }
  };

  // ── Seguimiento CRUD ───────────────────────────────────────────
  const resetSegForm = () => {
    setSegEdit(null);
    setSegFecha(new Date());
    setSegDescripcion("");
    setSegEsInterno(false);
    setSegArchivo(undefined);
  };
  const openNewSeg = () => {
    resetSegForm();
    setSegOpen(true);
  };
  const openEditSeg = (row: SeguimientoDemanda) => {
    setSegEdit(row);
    setSegFecha(toDateSafe(row.fecha) ?? new Date());
    setSegDescripcion(row.descripcion ?? "");
    setSegEsInterno(!!row.esInterno);
    setSegArchivo(undefined);
    setSegOpen(true);
  };
  const saveSeg = async () => {
    if (!clienteId || !deudorId || !demandaId || !puedeEditar || segSaving) return;
    const payload = { fecha: segFecha, descripcion: segDescripcion.trim(), esInterno: segEsInterno };
    try {
      setSegSaving(true);
      if (segEdit?.id) {
        await updateSeguimientoDemanda(clienteId, deudorId, demandaId, segEdit.id, payload, segArchivo);
        toast.success("✓ Seguimiento actualizado");
      } else {
        const uid = getAuth().currentUser?.uid;
        if (!uid) {
          toast.error("No se pudo obtener el usuario autenticado");
          return;
        }
        await addSeguimientoDemanda(uid, clienteId, deudorId, demandaId, payload, segArchivo);
        setForm((s) => ({ ...s, fechaUltimaRevision: ymd(segFecha) }));
        toast.success("✓ Seguimiento creado");
      }
      setSegOpen(false);
      resetSegForm();
      const segs = await getSeguimientosDemanda(clienteId, deudorId, demandaId);
      setSegRows(segs);
    } catch {
      toast.error("⚠️ No se pudo guardar el seguimiento");
    } finally {
      setSegSaving(false);
    }
  };
  const removeSeg = async (id: string) => {
    if (!clienteId || !deudorId || !demandaId || !puedeEditar) return;
    if (!window.confirm("¿Eliminar este registro?")) return;
    try {
      await deleteSeguimientoDemanda(clienteId, deudorId, demandaId, id);
      toast.success("✓ Registro eliminado");
      setSegRows((p) => p.filter((x) => x.id !== id));
    } catch {
      toast.error("⚠️ No se pudo eliminar el registro");
    }
  };

  const segVisibles = React.useMemo(
    () => (isExterno ? segRows.filter((r) => !r.esInterno) : segRows),
    [segRows, isExterno]
  );

  // ── CPNU ───────────────────────────────────────────────────────
  const [cpnu, setCpnu] = React.useState<{
    actuaciones: any[];
    total: number;
    ultima: string | null;
    privado: boolean | null;
    consultado: boolean;
    error: string | null;
    loading: boolean;
    show: boolean;
  }>({
    actuaciones: [],
    total: 0,
    ultima: null,
    privado: null,
    consultado: false,
    error: null,
    loading: false,
    show: false,
  });

  const consultarCPNU = async () => {
    const radicado = form.numeroRadicado.trim();
    if (radicado.length !== 23) {
      setCpnu((s) => ({ ...s, error: "El radicado debe tener exactamente 23 dígitos." }));
      return;
    }
    setCpnu((s) => ({ ...s, loading: true, error: null }));
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch(CPNU_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ radicado }),
      });
      const data = await res.json();
      if (res.status === 404) {
        setCpnu((s) => ({
          ...s,
          privado: null,
          actuaciones: [],
          error: "Proceso no encontrado en CPNU. Puede ser Juzgados de Pequeñas Causas (TYBA).",
          consultado: true,
          loading: false,
        }));
        return;
      }
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      const nuevoProceso = {
        ...(procesoJudicial ?? {}),
        esPrivado: data.esPrivado ?? false,
        fechaUltimaActuacion: data.fechaUltimaActuacion ?? null,
      };
      setProcesoJudicial(nuevoProceso);
      setCpnu((s) => ({
        ...s,
        actuaciones: data.actuaciones ?? [],
        total: data.totalActuaciones ?? 0,
        ultima: data.fechaUltimaActuacion ?? null,
        privado: data.esPrivado ?? false,
        consultado: true,
        loading: false,
      }));
      if (clienteId && deudorId && demandaId) {
        actualizarProcesoJudicialDemanda(clienteId, deudorId, demandaId, nuevoProceso).catch(
          () => {}
        );
      }
    } catch (err: any) {
      setCpnu((s) => ({ ...s, error: err.message ?? "Error de conexión", loading: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <header className="space-y-4">
          <AppBreadcrumb
            items={[
              { label: "Clientes", href: "/clientes-tables" },
              { label: nombreCliente, href: `/deudores/${clienteId}` },
              { label: deudorNombre, href: `/clientes/${clienteId}/deudores/${deudorId}` },
              { label: "Demanda" },
            ]}
          />
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <Gavel className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <Typography variant="h1" className="!text-brand-primary font-bold">
                  Demanda
                </Typography>
                <Typography variant="small">
                  {deudorNombre}
                  {form.numeroRadicado ? ` · ${form.numeroRadicado}` : ""}
                </Typography>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate(-1)} className="gap-2 border-brand-secondary/30">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
          </div>
        </header>

        {/* ── Datos principales ── */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-red-50 to-orange-50 p-4 md:p-5 border-b border-red-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-red-600" />
              <Typography variant="h3" className="!text-red-700 font-semibold">
                Datos de la demanda
              </Typography>
            </div>
            {puedeEditar && (
              <Button onClick={guardar} disabled={saving} variant="brand" className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            )}
          </div>

          <div className="p-4 md:p-5 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FieldInput label="Número de radicado" icon={Hash} value={form.numeroRadicado} readOnly={readOnly} onChange={(v) => setForm((s) => ({ ...s, numeroRadicado: v }))} />
              <FieldInput label="Juzgado" icon={Building2} value={form.juzgado} readOnly={readOnly} onChange={(v) => setForm((s) => ({ ...s, juzgado: v }))} />
              <FieldInput label="Localidad" icon={MapPin} value={form.localidad} readOnly={readOnly} onChange={(v) => setForm((s) => ({ ...s, localidad: v }))} />

              <div className="space-y-2">
                <Label className="text-brand-secondary font-medium flex items-center gap-2">
                  <Gavel className="h-4 w-4" /> Estado
                </Label>
                <Select value={form.estado} onValueChange={(v) => setForm((s) => ({ ...s, estado: v as Demanda["estado"] }))} disabled={readOnly}>
                  <SelectTrigger className="w-full border-brand-secondary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activa">Activa</SelectItem>
                    <SelectItem value="terminada">Terminada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-brand-secondary font-medium flex items-center gap-2">
                  <Gavel className="h-4 w-4" /> Demanda sustituto
                </Label>
                <Select value={form.demandaSustituto ? "si" : "no"} onValueChange={(v) => setForm((s) => ({ ...s, demandaSustituto: v === "si" }))} disabled={readOnly}>
                  <SelectTrigger className="w-full border-brand-secondary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="si">Sí</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-brand-secondary font-medium flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" /> Fecha última revisión
                </Label>
                {readOnly ? (
                  <Input value={form.fechaUltimaRevision ? fmtFecha(parseLocalYmd(form.fechaUltimaRevision)) : ""} readOnly className="bg-gray-50 border-brand-secondary/30" />
                ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal border-brand-secondary/30", !form.fechaUltimaRevision && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.fechaUltimaRevision ? fmtFecha(parseLocalYmd(form.fechaUltimaRevision)) : "Seleccionar fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={form.fechaUltimaRevision ? parseLocalYmd(form.fechaUltimaRevision) : undefined} onSelect={(d) => setForm((s) => ({ ...s, fechaUltimaRevision: d ? d.toISOString().slice(0, 10) : "" }))} initialFocus />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>

            {/* ── Demandados con notificaciones ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-brand-secondary font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" /> Demandados
                  {demandados.length > 0 && (
                    <span className="inline-flex items-center rounded-full bg-brand-primary/10 text-brand-primary px-2 py-0.5 text-xs font-semibold">
                      {demandados.length}
                    </span>
                  )}
                </Label>
              </div>
              {demandados.length === 0 && (
                <p className="text-sm text-muted-foreground py-1">
                  {readOnly ? "Sin demandados registrados." : "Agrega al menos un demandado."}
                </p>
              )}
              <div className="space-y-2.5">
                {demandados.map((dem, di) => {
                  const abierto = expandidos.has(di);
                  const totalNotif = dem.notificaciones.length;
                  const sinCoteje = dem.notificaciones.filter((n) => !n.coteje).length;
                  return (
                    <div key={di} className="rounded-xl border border-brand-secondary/15 bg-white shadow-sm overflow-hidden">
                      {/* Encabezado: nombre + documento + resumen */}
                      <div className="flex items-start gap-2 p-3 bg-brand-primary/[0.02]">
                        <div className="mt-6 shrink-0">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary text-xs font-bold">
                            {di + 1}
                          </span>
                        </div>
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">Nombre completo</p>
                            <Input placeholder="Ej: Juan Pérez" value={dem.nombre} readOnly={readOnly} onChange={(e) => updateDemandado(di, "nombre", e.target.value)} className="border-brand-secondary/30" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">Número de documento</p>
                            <Input placeholder="Ej: 12345678" value={dem.numeroDocumento} readOnly={readOnly} onChange={(e) => updateDemandado(di, "numeroDocumento", e.target.value)} className="border-brand-secondary/30" />
                          </div>
                        </div>
                        {!readOnly && (
                          <Button variant="ghost" size="sm" onClick={() => removeDemandado(di)} className="hover:bg-red-50 mt-5 shrink-0" title="Eliminar demandado">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>

                      {/* Barra colapsable de notificaciones */}
                      <button
                        type="button"
                        onClick={() => toggleExpandido(di)}
                        className="w-full flex items-center gap-2 px-3 py-2 border-t border-brand-secondary/10 hover:bg-brand-primary/[0.03] transition-colors"
                      >
                        <Bell className="h-3.5 w-3.5 text-brand-secondary shrink-0" />
                        <span className="text-xs font-medium text-brand-secondary">Notificaciones</span>
                        <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-[11px] font-semibold">
                          {totalNotif}
                        </span>
                        {sinCoteje > 0 && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-semibold">
                            {sinCoteje} sin coteje
                          </span>
                        )}
                        {totalNotif > 0 && sinCoteje === 0 && (
                          <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-[11px] font-semibold">
                            cotejadas
                          </span>
                        )}
                        <ChevronDown className={cn("h-4 w-4 text-brand-secondary ml-auto transition-transform", abierto && "rotate-180")} />
                      </button>

                      {/* Cuerpo de notificaciones */}
                      {abierto && (
                        <div className="px-3 pb-3 pt-1 space-y-2 bg-brand-primary/[0.015]">
                          {totalNotif === 0 && (
                            <p className="text-xs text-muted-foreground py-1">Sin notificaciones.</p>
                          )}
                          {dem.notificaciones.map((n, ni) => (
                            <div key={ni} className="grid grid-cols-1 sm:grid-cols-[minmax(120px,1fr)_minmax(140px,1fr)_minmax(100px,120px)_auto] gap-2 items-end rounded-lg border border-brand-secondary/10 bg-white p-2">
                              <div className="space-y-1">
                                <p className="text-[11px] text-muted-foreground">Tipo</p>
                                <Select value={String(n.tipo)} onValueChange={(v) => updateNotificacion(di, ni, { tipo: v })} disabled={readOnly}>
                                  <SelectTrigger className="h-9 border-brand-secondary/30">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TIPOS_NOTIFICACION_DEMANDA.map((t) => (
                                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[11px] text-muted-foreground">Fecha de notificación</p>
                                {readOnly ? (
                                  <Input value={fmtFecha(n.fecha)} readOnly className="h-9 bg-gray-50 border-brand-secondary/30" />
                                ) : (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" className={cn("h-9 w-full justify-start text-left font-normal border-brand-secondary/30", !toDateSafe(n.fecha) && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {toDateSafe(n.fecha) ? fmtFecha(n.fecha) : "Fecha"}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                      <Calendar mode="single" selected={toDateSafe(n.fecha) ?? undefined} onSelect={(d) => updateNotificacion(di, ni, { fecha: d ?? null })} initialFocus />
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </div>
                              <div className="space-y-1">
                                <p className="text-[11px] text-muted-foreground">Coteje</p>
                                <Select value={n.coteje ? "si" : "no"} onValueChange={(v) => updateNotificacion(di, ni, { coteje: v === "si" })} disabled={readOnly}>
                                  <SelectTrigger className={cn("h-9 border-brand-secondary/30", n.coteje ? "text-green-700" : "text-amber-700")}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="no">No</SelectItem>
                                    <SelectItem value="si">Sí</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              {!readOnly && (
                                <Button variant="ghost" size="sm" onClick={() => removeNotificacion(di, ni)} className="hover:bg-red-50 h-9 w-9 p-0 self-end" title="Eliminar notificación">
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          ))}
                          {!readOnly && (
                            <Button variant="outline" size="sm" onClick={() => addNotificacion(di)} className="gap-1.5 border-brand-secondary/30 h-8">
                              <Plus className="h-3.5 w-3.5" /> Agregar notificación
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {!readOnly && (
                <Button variant="outline" size="sm" onClick={addDemandado} className="gap-2 border-brand-secondary/30">
                  <Plus className="h-4 w-4" /> Agregar demandado
                </Button>
              )}
            </div>

            {/* ── Etiquetas (uso interno; ocultas para cliente/deudor) ── */}
            {!isExterno && (
            <div className="space-y-3">
              <Label className="text-brand-secondary font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" /> Etiquetas
              </Label>
              {etiquetas.length === 0 && (
                <p className="text-sm text-muted-foreground py-1">Sin etiquetas.</p>
              )}
              <div className="space-y-2">
                {etiquetas.map((et, i) => (
                  <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-indigo-100 bg-indigo-50/30 p-2.5">
                    <div className="space-y-1 min-w-[170px] flex-1">
                      <p className="text-[11px] text-muted-foreground">Etiqueta</p>
                      <Select value={et.etiquetaId ?? ""} onValueChange={(v) => pickEtiqueta(i, v)} disabled={readOnly}>
                        <SelectTrigger className="h-9 border-brand-secondary/30">
                          <SelectValue placeholder="Selecciona" />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogo.map((c) => (
                            <SelectItem key={c.id} value={c.id!}>{c.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 min-w-[200px] flex-[2]">
                      <p className="text-[11px] text-muted-foreground">Detalle</p>
                      <Input value={et.detalle} readOnly={readOnly} onChange={(e) => updateEtiqueta(i, { detalle: e.target.value })} className="h-9 border-brand-secondary/30" />
                    </div>
                    <div className="space-y-1 min-w-[150px]">
                      <p className="text-[11px] text-muted-foreground">Fecha de acción</p>
                      {readOnly ? (
                        <Input value={fmtFecha(et.fecha)} readOnly className="h-9 bg-gray-50 border-brand-secondary/30" />
                      ) : (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("h-9 w-full justify-start text-left font-normal border-brand-secondary/30", !toDateSafe(et.fecha) && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {toDateSafe(et.fecha) ? fmtFecha(et.fecha) : "Fecha"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={toDateSafe(et.fecha) ?? undefined} onSelect={(d) => updateEtiqueta(i, { fecha: d ?? null })} initialFocus />
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                    {!readOnly && (
                      <Button variant="ghost" size="sm" onClick={() => removeEtiqueta(i)} className="hover:bg-red-50 h-9" title="Quitar etiqueta">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {!readOnly && (
                <Button variant="outline" size="sm" onClick={addEtiqueta} className="gap-2 border-brand-secondary/30">
                  <Plus className="h-4 w-4" /> Agregar etiqueta
                </Button>
              )}
            </div>
            )}

            {puedeEditar && (
              <div className="flex justify-end pt-1">
                <Button onClick={guardar} disabled={saving} variant="brand" className="gap-2 shadow-md">
                  <Save className="h-4 w-4" />
                  {saving ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* ── Seguimiento de la demanda ── */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10 flex items-center justify-between">
            <Typography variant="h3" className="!text-brand-secondary font-semibold">
              Seguimiento de la demanda
            </Typography>
            {puedeEditar && (
              <Button variant="brand" onClick={openNewSeg} className="gap-2">
                <Plus className="h-4 w-4" /> Nuevo seguimiento
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                  <TableHead className="w-[140px] text-brand-secondary font-semibold">Fecha</TableHead>
                  <TableHead className="text-brand-secondary font-semibold">Descripción</TableHead>
                  {!isExterno && <TableHead className="w-[100px] text-center text-brand-secondary font-semibold">Interno</TableHead>}
                  <TableHead className="w-[110px] text-brand-secondary font-semibold">Archivo</TableHead>
                  {puedeEditar && <TableHead className="w-[130px] text-center text-brand-secondary font-semibold">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {segVisibles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No hay seguimientos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  segVisibles.map((row, index) => (
                    <TableRow key={row.id} className={cn("border-brand-secondary/5", index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]", "hover:bg-brand-primary/5")}>
                      <TableCell className="text-gray-700 font-medium">{fmtFecha(row.fecha)}</TableCell>
                      <TableCell><ExpandableCell text={row.descripcion ?? ""} /></TableCell>
                      {!isExterno && (
                        <TableCell className="text-center">
                          <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", row.esInterno ? "bg-orange-100 text-orange-900" : "bg-gray-100 text-gray-700")}>
                            {row.esInterno ? "Sí" : "No"}
                          </span>
                        </TableCell>
                      )}
                      <TableCell>
                        {row.archivoUrl ? (
                          <a href={row.archivoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-primary hover:text-brand-secondary text-sm font-medium">
                            <Download className="h-3.5 w-3.5" /> Ver
                          </a>
                        ) : (
                          <span className="text-sm">—</span>
                        )}
                      </TableCell>
                      {puedeEditar && (
                        <TableCell>
                          <div className="flex justify-center gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openEditSeg(row)} className="hover:bg-brand-primary/10">
                              <Edit className="h-4 w-4 text-brand-primary" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => removeSeg(row.id!)} className="hover:bg-red-50">
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* ── CPNU (uso interno; oculto para cliente/deudor) ── */}
        {!isExterno && form.numeroRadicado && (
          <section className="rounded-2xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
            <div className="w-full bg-gradient-to-r from-indigo-50 to-blue-50 px-5 py-4 border-b border-indigo-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 cursor-pointer select-none min-w-0" onClick={() => setCpnu((s) => ({ ...s, show: !s.show }))}>
                <Scale className="h-5 w-5 text-indigo-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-indigo-800">Rama Judicial (CPNU)</p>
                  <p className="text-xs text-indigo-500 mt-0.5 font-mono truncate">{form.numeroRadicado}</p>
                </div>
                <ChevronDown className={cn("h-4 w-4 text-indigo-400 transition-transform shrink-0", cpnu.show && "rotate-180")} />
              </div>
              <button type="button" onClick={consultarCPNU} disabled={cpnu.loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium disabled:opacity-60 shrink-0">
                {cpnu.loading ? (<><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Consultando...</>) : cpnu.consultado ? (<><RefreshCw className="h-3.5 w-3.5" /> Actualizar</>) : (<><Scale className="h-3.5 w-3.5" /> Consultar</>)}
              </button>
            </div>
            {cpnu.show && (
              <div className="p-4 md:p-5 space-y-3">
                {cpnu.error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{cpnu.error}</span>
                  </div>
                )}
                {cpnu.consultado && !cpnu.loading && cpnu.privado === true && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                    <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" /> Proceso privado — actuaciones no públicas en CPNU.
                  </div>
                )}
                {cpnu.consultado && !cpnu.loading && cpnu.privado === false && (
                  <>
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                      <span>{cpnu.actuaciones.length} de {cpnu.total} actuaciones</span>
                      {cpnu.ultima && <span>Última: <span className="font-medium text-indigo-700">{cpnu.ultima}</span></span>}
                    </div>
                    {cpnu.actuaciones.length > 0 && (
                      <div className="rounded-xl border border-indigo-100 overflow-hidden overflow-x-auto">
                        <table className="w-full text-xs min-w-[600px]">
                          <thead className="bg-indigo-50 border-b border-indigo-100">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-indigo-700 w-8">#</th>
                              <th className="px-3 py-2 text-left font-semibold text-indigo-700 w-24">Fecha</th>
                              <th className="px-3 py-2 text-left font-semibold text-indigo-700 w-36">Actuación</th>
                              <th className="px-3 py-2 text-left font-semibold text-indigo-700">Anotación</th>
                              <th className="px-3 py-2 text-center font-semibold text-indigo-700 w-12">Docs</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-indigo-50">
                            {cpnu.actuaciones.map((act) => (
                              <tr key={act.numero} className="hover:bg-indigo-50/40">
                                <td className="px-3 py-2.5 text-muted-foreground text-center">{act.numero}</td>
                                <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{act.fecha || "—"}</td>
                                <td className="px-3 py-2.5 font-medium text-indigo-700">{act.tipo || "—"}</td>
                                <td className="px-3 py-2.5 text-gray-600 whitespace-pre-line">{act.anotacion || "—"}</td>
                                <td className="px-3 py-2.5 text-center">{act.conDocumentos ? "Sí" : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Observaciones ── */}
        {!isExterno && (
          <section className="rounded-2xl border border-orange-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-orange-50 to-orange-100/50 p-4 md:p-5 border-b border-orange-200/50">
              <Typography variant="h3" className="!text-orange-900 font-semibold">Observaciones internas</Typography>
            </div>
            <div className="p-4 md:p-5">
              <Textarea value={obsInterna} onChange={(e) => setObsInterna(e.target.value)} readOnly={!puedeEditar} className="min-h-32 border-brand-secondary/30" />
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-green-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-green-50 to-green-100/50 p-4 md:p-5 border-b border-green-200/50">
            <Typography variant="h3" className="!text-green-900 font-semibold">Observaciones del conjunto</Typography>
          </div>
          <div className="p-4 md:p-5">
            <Textarea value={obsCliente} onChange={(e) => setObsCliente(e.target.value)} readOnly={!puedeEditar} className="min-h-32 border-brand-secondary/30" placeholder={puedeEditar ? "Escribe tu observación..." : ""} />
          </div>
        </section>

        {puedeEditar && (
          <div className="flex justify-end">
            <Button onClick={guardar} disabled={saving} variant="brand" className="gap-2 shadow-md">
              <Save className="h-4 w-4" />
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        )}
      </div>

      {/* Dialog seguimiento */}
      <Dialog open={segOpen} onOpenChange={(v) => { if (!v) { setSegOpen(false); resetSegForm(); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-brand-primary text-xl font-bold flex items-center gap-2">
              <Gavel className="h-5 w-5" />
              {segEdit ? "Editar registro" : "Nuevo registro"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-brand-secondary font-medium">Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" disabled={segSaving} className="w-full justify-start font-normal h-10">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {segFecha ? segFecha.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={segFecha} defaultMonth={segFecha} onSelect={(d) => d && setSegFecha(d)} initialFocus captionLayout="dropdown" fromYear={new Date().getFullYear() - 10} toYear={new Date().getFullYear() + 1} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-brand-secondary font-medium">¿Es interno?</Label>
              <Select value={segEsInterno ? "si" : "no"} onValueChange={(v) => setSegEsInterno(v === "si")}>
                <SelectTrigger className="w-full border-brand-secondary/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="si">Sí</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Interno: visible para el equipo (no para cliente).</p>
            </div>
            <div className="space-y-2">
              <Label className="text-brand-secondary font-medium">Descripción</Label>
              <Textarea value={segDescripcion} onChange={(e) => setSegDescripcion(e.target.value)} placeholder="Describe el seguimiento realizado..." className="min-h-32 border-brand-secondary/30" />
            </div>
            <div className="space-y-2">
              <Label className="text-brand-secondary font-medium">Archivo adjunto</Label>
              <Input type="file" onChange={(e) => setSegArchivo(e.target.files?.[0])} className="border-brand-secondary/30" />
              {segEdit?.archivoUrl && !segArchivo && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <a href={segEdit.archivoUrl} target="_blank" rel="noreferrer" className="text-brand-primary hover:underline">Ver archivo actual</a>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSegOpen(false); resetSegForm(); }} disabled={segSaving} className="border-brand-secondary/30">Cancelar</Button>
            <Button onClick={saveSeg} disabled={segSaving} variant="brand" className="gap-2">
              {segSaving ? (<><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Guardando...</>) : (<><Save className="h-4 w-4" /> Guardar</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldInput({
  label,
  icon: Icon,
  value,
  readOnly,
  onChange,
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  readOnly: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-brand-secondary font-medium flex items-center gap-2">
        <Icon className="h-4 w-4" /> {label}
      </Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} className={cn("border-brand-secondary/30", readOnly && "bg-gray-50 cursor-not-allowed")} />
    </div>
  );
}
