// modules/casos/components/CasoDetailPage.tsx
//
// Detalle del caso. La misma pantalla sirve a dos audiencias:
//  - equipo  → /clientes-particulares/:clienteParticularId/casos/:casoId
//  - cliente → /mis-casos/:casoId   (clienteParticularId = su propio uid)
// Lo que cambia es qué puede editar, resuelto por permisos.
import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  CalendarDays,
  FileText,
  Gavel,
  MessageSquare,
  Paperclip,
  Plus,
  Save,
  Send,
  Tag,
  Trash2,
  Upload,
  Users,
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
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/shared/ui/table";
import { Typography } from "@/shared/design-system/components/Typography";
import AppBreadcrumb from "@/shared/components/app-breadcrumb";
import { cn } from "@/shared/lib/cn";
import { openStorageFile } from "@/shared/lib/openStorageFile";
import { PERMS } from "@/shared/constants/acl";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { TIPO_SEGUIMIENTO, codeToLabel } from "@/shared/constants/tipoSeguimiento";
import type { TipoSeguimientoCode } from "@/shared/constants/tipoSeguimiento";
import { toDateSafe } from "@/modules/cobranza/models/demanda.model";
import { getEtiquetasDemanda } from "@/modules/cobranza/services/etiquetaDemandaService";
import type { EtiquetaDemanda } from "@/modules/cobranza/models/etiquetaDemanda.model";

import {
  actualizarCaso,
  agregarDocumentoCaso,
  eliminarDocumentoCaso,
  getCasoById,
} from "../services/casoService";
import {
  addSeguimientoCaso,
  deleteSeguimientoCaso,
  getSeguimientosCaso,
} from "../services/seguimientoCasoService";
import {
  addObservacionCaso,
  getObservacionesCaso,
} from "../services/observacionCasoService";
import { getTiposCaso } from "../services/tipoCasoService";
import { getClienteParticularById } from "../services/clienteParticularService";
import {
  ESTADO_CASO_LABEL,
  ROL_CLIENTE_LABEL,
  type Caso,
  type ContraparteCaso,
  type EtiquetaEnCaso,
} from "../models/caso.model";
import type { SeguimientoCaso } from "../models/seguimientoCaso.model";
import type { ObservacionCaso } from "../models/observacionCaso.model";

const SIN_TIPO = "__sin__";

const fmt = new Intl.DateTimeFormat("es-CO", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const fmtLargo = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

function fmtFecha(v: any): string {
  const d = toDateSafe(v);
  return d ? fmt.format(d) : "—";
}

function ymd(v: any): string {
  const d = toDateSafe(v);
  if (!d) return "";
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function parseLocalYmd(s: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export default function CasoDetailPage() {
  const params = useParams<{ clienteParticularId?: string; casoId: string }>();
  const navigate = useNavigate();
  const { can } = useAcl();
  const { usuario, usuarioSistema, roles } = useUsuarioActual();

  // En /mis-casos/:casoId el cliente es el propio usuario logueado.
  const clienteParticularId = params.clienteParticularId ?? usuario?.uid ?? "";
  const casoId = params.casoId ?? "";
  const esVistaCliente = !params.clienteParticularId;

  const puedeEditarCaso = can(PERMS.Casos_Edit) && !esVistaCliente;
  const puedeEditarSeguimiento = can(PERMS.Casos_Seguimiento_Edit) && !esVistaCliente;
  const puedeSubirDocumentos = can(PERMS.Casos_Documentos_Edit);
  const puedeComentar = can(PERMS.Casos_Obs_Create);
  const rolAutor: "cliente" | "equipo" = roles.includes("clienteCaso") ? "cliente" : "equipo";
  const nombreAutor = usuarioSistema?.nombre || usuario?.email || "Usuario";

  const [caso, setCaso] = React.useState<Caso | null>(null);
  const [clienteNombre, setClienteNombre] = React.useState("");
  const [tipos, setTipos] = React.useState<{ id?: string; nombre: string }[]>([]);
  const [catalogoEtiquetas, setCatalogoEtiquetas] = React.useState<EtiquetaDemanda[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [form, setForm] = React.useState({
    titulo: "",
    tipoCaso: SIN_TIPO,
    rolCliente: "demandante" as NonNullable<Caso["rolCliente"]>,
    numeroRadicado: "",
    juzgado: "",
    localidad: "",
    estado: "activo" as Caso["estado"],
    fechaInicio: "",
    descripcion: "",
  });
  const [contraparte, setContraparte] = React.useState<ContraparteCaso[]>([]);
  const [etiquetas, setEtiquetas] = React.useState<EtiquetaEnCaso[]>([]);

  // Seguimiento
  const [seguimientos, setSeguimientos] = React.useState<SeguimientoCaso[]>([]);
  const [segFecha, setSegFecha] = React.useState<Date>(() => new Date());
  const [segTipo, setSegTipo] = React.useState<TipoSeguimientoCode>("otro");
  const [segDescripcion, setSegDescripcion] = React.useState("");
  const [segArchivo, setSegArchivo] = React.useState<File | undefined>();
  const [segSaving, setSegSaving] = React.useState(false);

  // Observaciones
  const [observaciones, setObservaciones] = React.useState<ObservacionCaso[]>([]);
  const [obsTexto, setObsTexto] = React.useState("");
  const [obsArchivo, setObsArchivo] = React.useState<File | undefined>();
  const [obsSaving, setObsSaving] = React.useState(false);

  const [subiendoDoc, setSubiendoDoc] = React.useState(false);

  const cargar = React.useCallback(async () => {
    if (!clienteParticularId || !casoId) return;
    try {
      setLoading(true);
      const [c, segs, obs, tps, etqs, cli] = await Promise.all([
        getCasoById(clienteParticularId, casoId),
        getSeguimientosCaso(clienteParticularId, casoId),
        getObservacionesCaso(clienteParticularId, casoId),
        getTiposCaso(true),
        getEtiquetasDemanda(true),
        getClienteParticularById(clienteParticularId),
      ]);

      setCaso(c);
      setSeguimientos(segs);
      setObservaciones(obs);
      setTipos(tps);
      setCatalogoEtiquetas(etqs);
      setClienteNombre(cli?.nombre ?? c?.clienteNombre ?? "");

      if (c) {
        setForm({
          titulo: c.titulo ?? "",
          tipoCaso: c.tipoCaso || SIN_TIPO,
          rolCliente: c.rolCliente ?? "demandante",
          numeroRadicado: c.numeroRadicado ?? "",
          juzgado: c.juzgado ?? "",
          localidad: c.localidad ?? "",
          estado: c.estado,
          fechaInicio: ymd(c.fechaInicio),
          descripcion: c.descripcion ?? "",
        });
        setContraparte(c.contraparte ?? []);
        setEtiquetas(c.etiquetas ?? []);
      }
    } catch {
      toast.error("⚠️ No se pudo cargar el caso");
    } finally {
      setLoading(false);
    }
  }, [clienteParticularId, casoId]);

  React.useEffect(() => {
    cargar();
  }, [cargar]);

  /* ---------- Datos del caso ---------- */

  const guardarCaso = async () => {
    if (!puedeEditarCaso) return;
    try {
      setSaving(true);
      await actualizarCaso(clienteParticularId, casoId, {
        titulo: form.titulo,
        tipoCaso: form.tipoCaso === SIN_TIPO ? "" : form.tipoCaso,
        rolCliente: form.rolCliente,
        numeroRadicado: form.numeroRadicado,
        juzgado: form.juzgado,
        localidad: form.localidad,
        estado: form.estado,
        descripcion: form.descripcion,
        fechaInicio: form.fechaInicio ? parseLocalYmd(form.fechaInicio) ?? null : null,
        contraparte,
        etiquetas,
      });
      toast.success("✓ Caso guardado");
      await cargar();
    } catch {
      toast.error("⚠️ No se pudo guardar el caso");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Documentos ---------- */

  const subirDocumento = async (file?: File | null) => {
    if (!file || !puedeSubirDocumentos) return;
    try {
      setSubiendoDoc(true);
      const doc = await agregarDocumentoCaso(clienteParticularId, casoId, file, {
        uid: usuario?.uid ?? "",
        nombre: nombreAutor,
        rol: rolAutor,
      });
      setCaso((prev) =>
        prev ? { ...prev, documentos: [...(prev.documentos ?? []), doc] } : prev
      );
      toast.success("✓ Documento cargado");
    } catch {
      toast.error("⚠️ No se pudo subir el documento");
    } finally {
      setSubiendoDoc(false);
    }
  };

  const borrarDocumento = async (documentoId: string, nombre: string) => {
    if (!window.confirm(`¿Eliminar el documento "${nombre}"?`)) return;
    try {
      await eliminarDocumentoCaso(clienteParticularId, casoId, documentoId);
      setCaso((prev) =>
        prev
          ? { ...prev, documentos: (prev.documentos ?? []).filter((d) => d.id !== documentoId) }
          : prev
      );
      toast.success("✓ Documento eliminado");
    } catch {
      toast.error("⚠️ No se pudo eliminar el documento");
    }
  };

  /* ---------- Seguimiento ---------- */

  const registrarSeguimiento = async () => {
    if (!puedeEditarSeguimiento) return;
    if (!segDescripcion.trim()) {
      toast.error("Escribe la descripción del avance.");
      return;
    }
    try {
      setSegSaving(true);
      await addSeguimientoCaso(
        clienteParticularId,
        casoId,
        {
          fecha: segFecha,
          descripcion: segDescripcion.trim(),
          tipoSeguimiento: segTipo,
        },
        { uid: usuario?.uid ?? "", nombre: nombreAutor },
        segArchivo
      );
      setSegDescripcion("");
      setSegArchivo(undefined);
      setSegFecha(new Date());
      toast.success("✓ Avance registrado. Se notificó al cliente.");
      await cargar();
    } catch {
      toast.error("⚠️ No se pudo registrar el avance");
    } finally {
      setSegSaving(false);
    }
  };

  const borrarSeguimiento = async (id: string) => {
    if (!window.confirm("¿Eliminar este avance?")) return;
    try {
      await deleteSeguimientoCaso(clienteParticularId, casoId, id);
      setSeguimientos((prev) => prev.filter((s) => s.id !== id));
      toast.success("✓ Avance eliminado");
    } catch {
      toast.error("⚠️ No se pudo eliminar");
    }
  };

  /* ---------- Observaciones ---------- */

  const enviarObservacion = async () => {
    if (!puedeComentar || !obsTexto.trim()) return;
    try {
      setObsSaving(true);
      await addObservacionCaso(
        clienteParticularId,
        casoId,
        obsTexto,
        { uid: usuario?.uid ?? "", nombre: nombreAutor, rol: rolAutor },
        obsArchivo
      );
      setObsTexto("");
      setObsArchivo(undefined);
      setObservaciones(await getObservacionesCaso(clienteParticularId, casoId));
    } catch {
      toast.error("⚠️ No se pudo enviar la observación");
    } finally {
      setObsSaving(false);
    }
  };

  /* ---------- Etiquetas / contraparte ---------- */

  const agregarEtiqueta = () =>
    setEtiquetas((prev) => [...prev, { nombre: "", detalle: "", fecha: null }]);

  const actualizarEtiqueta = (idx: number, patch: Partial<EtiquetaEnCaso>) =>
    setEtiquetas((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));

  const quitarEtiqueta = (idx: number) =>
    setEtiquetas((prev) => prev.filter((_, i) => i !== idx));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
      </div>
    );
  }

  if (!caso) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Typography variant="h3">Caso no encontrado</Typography>
      </div>
    );
  }

  // Las rutas no filtran por rol: un cliente que escriba a mano la URL del
  // equipo vería el caso de otro. Se corta aquí.
  if (!esVistaCliente && !can(PERMS.ClientesParticulares_Read)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Typography variant="h3">No tienes acceso a este caso.</Typography>
      </div>
    );
  }

  const readOnly = !puedeEditarCaso;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <AppBreadcrumb
          items={
            esVistaCliente
              ? [{ label: "Mis casos", href: "/mis-casos" }, { label: form.titulo || "Caso" }]
              : [
                  { label: "Clientes particulares", href: "/clientes-particulares" },
                  { label: clienteNombre || "Cliente", href: `/clientes-particulares/${clienteParticularId}` },
                  { label: form.titulo || "Caso" },
                ]
          }
        />

        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <Gavel className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <Typography variant="h1" className="!text-brand-primary font-bold">
                {form.titulo || "Caso sin título"}
              </Typography>
              <Typography variant="small">
                {clienteNombre}
                {form.tipoCaso !== SIN_TIPO ? ` · ${form.tipoCaso}` : ""}
              </Typography>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                caso.estado === "terminado"
                  ? "bg-gray-100 text-gray-700"
                  : "bg-green-100 text-green-800"
              )}
            >
              {ESTADO_CASO_LABEL[caso.estado]}
            </span>
            <Button variant="outline" onClick={() => navigate(-1)} className="gap-2 border-brand-secondary/30">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
          </div>
        </header>

        {/* ============ Datos del caso ============ */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-red-50 to-orange-50 p-4 md:p-5 border-b border-red-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-600" />
              <Typography variant="h3" className="!text-red-700 font-semibold">
                Datos del caso
              </Typography>
            </div>
            {puedeEditarCaso && (
              <Button onClick={guardarCaso} disabled={saving} variant="brand" className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            )}
          </div>

          <div className="p-4 md:p-5 grid gap-4 md:grid-cols-2">
            <Campo
              label="Título del caso"
              value={form.titulo}
              readOnly={readOnly}
              onChange={(v) => setForm((s) => ({ ...s, titulo: v }))}
            />

            <div className="space-y-2">
              <Label className="text-brand-secondary font-medium">Tipo de caso</Label>
              {readOnly ? (
                <Input value={form.tipoCaso === SIN_TIPO ? "—" : form.tipoCaso} readOnly className="bg-gray-50 border-brand-secondary/30" />
              ) : (
                <Select
                  value={form.tipoCaso}
                  onValueChange={(v) => setForm((s) => ({ ...s, tipoCaso: v }))}
                >
                  <SelectTrigger className="border-brand-secondary/30">
                    <SelectValue placeholder="Selecciona un tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_TIPO}>Sin definir</SelectItem>
                    {tipos.map((t) => (
                      <SelectItem key={t.id ?? t.nombre} value={t.nombre}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-brand-secondary font-medium">El cliente actúa como</Label>
              {readOnly ? (
                <Input value={ROL_CLIENTE_LABEL[form.rolCliente]} readOnly className="bg-gray-50 border-brand-secondary/30" />
              ) : (
                <Select
                  value={form.rolCliente}
                  onValueChange={(v) =>
                    setForm((s) => ({ ...s, rolCliente: v as typeof s.rolCliente }))
                  }
                >
                  <SelectTrigger className="border-brand-secondary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="demandante">Demandante</SelectItem>
                    <SelectItem value="demandado">Demandado</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-brand-secondary font-medium">Estado</Label>
              {readOnly ? (
                <Input value={ESTADO_CASO_LABEL[form.estado]} readOnly className="bg-gray-50 border-brand-secondary/30" />
              ) : (
                <Select
                  value={form.estado}
                  onValueChange={(v) => setForm((s) => ({ ...s, estado: v as Caso["estado"] }))}
                >
                  <SelectTrigger className="border-brand-secondary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="terminado">Terminado</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <Campo
              label="Número de radicado"
              value={form.numeroRadicado}
              readOnly={readOnly}
              onChange={(v) => setForm((s) => ({ ...s, numeroRadicado: v }))}
            />
            <Campo
              label="Juzgado"
              value={form.juzgado}
              readOnly={readOnly}
              onChange={(v) => setForm((s) => ({ ...s, juzgado: v }))}
            />
            <Campo
              label="Localidad / ciudad"
              value={form.localidad}
              readOnly={readOnly}
              onChange={(v) => setForm((s) => ({ ...s, localidad: v }))}
            />

            <div className="space-y-2">
              <Label className="text-brand-secondary font-medium">Fecha de inicio</Label>
              <SelectorFecha
                value={form.fechaInicio ? parseLocalYmd(form.fechaInicio) : undefined}
                readOnly={readOnly}
                onChange={(d) => setForm((s) => ({ ...s, fechaInicio: d ? ymd(d) : "" }))}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="text-brand-secondary font-medium">Descripción</Label>
              <Textarea
                value={form.descripcion}
                readOnly={readOnly}
                onChange={(e) => setForm((s) => ({ ...s, descripcion: e.target.value }))}
                rows={3}
                className={cn("border-brand-secondary/30", readOnly && "bg-gray-50")}
              />
            </div>
          </div>
        </section>

        {/* ============ Contraparte ============ */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10 flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-primary" />
            <Typography variant="h3" className="!text-brand-secondary font-semibold">
              Contraparte
            </Typography>
          </div>
          <div className="p-4 md:p-5 space-y-3">
            {contraparte.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {readOnly ? "Sin contraparte registrada." : "Agrega la contraparte del proceso."}
              </p>
            )}
            {contraparte.map((c, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 rounded-lg border border-brand-secondary/15 bg-brand-primary/[0.02]"
              >
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    placeholder="Nombre"
                    value={c.nombre}
                    readOnly={readOnly}
                    onChange={(e) =>
                      setContraparte((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, nombre: e.target.value } : it))
                      )
                    }
                    className={cn("border-brand-secondary/30", readOnly && "bg-gray-50")}
                  />
                  <Input
                    placeholder="Documento"
                    value={c.numeroDocumento}
                    readOnly={readOnly}
                    onChange={(e) =>
                      setContraparte((prev) =>
                        prev.map((it, i) =>
                          i === idx ? { ...it, numeroDocumento: e.target.value } : it
                        )
                      )
                    }
                    className={cn("border-brand-secondary/30", readOnly && "bg-gray-50")}
                  />
                </div>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setContraparte((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="hover:bg-red-50 shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            ))}
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setContraparte((prev) => [...prev, { nombre: "", numeroDocumento: "" }])
                }
                className="gap-2 border-brand-secondary/30"
              >
                <Plus className="h-4 w-4" />
                Agregar
              </Button>
            )}
          </div>
        </section>

        {/* ============ Etiquetas / próximas acciones ============ */}
        {!esVistaCliente && (
          <section className="rounded-2xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
            <div className="bg-indigo-50 p-4 md:p-5 border-b border-indigo-100 flex items-center gap-2">
              <Tag className="h-5 w-5 text-indigo-600" />
              <Typography variant="h3" className="!text-indigo-700 font-semibold">
                Etiquetas y próximas acciones
              </Typography>
            </div>
            <div className="p-4 md:p-5 space-y-3">
              {etiquetas.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin etiquetas.</p>
              )}
              {etiquetas.map((e, idx) => (
                <div
                  key={idx}
                  className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_150px_auto] items-start p-3 rounded-lg border border-indigo-100 bg-indigo-50/30"
                >
                  <Select
                    value={e.nombre || SIN_TIPO}
                    onValueChange={(v) => {
                      const et = catalogoEtiquetas.find((x) => x.nombre === v);
                      actualizarEtiqueta(idx, {
                        nombre: v === SIN_TIPO ? "" : v,
                        etiquetaId: et?.id,
                      });
                    }}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="border-brand-secondary/30 bg-white">
                      <SelectValue placeholder="Etiqueta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SIN_TIPO}>Sin etiqueta</SelectItem>
                      {catalogoEtiquetas.map((x) => (
                        <SelectItem key={x.id} value={x.nombre}>
                          {x.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Detalle"
                    value={e.detalle}
                    readOnly={readOnly}
                    onChange={(ev) => actualizarEtiqueta(idx, { detalle: ev.target.value })}
                    className={cn("border-brand-secondary/30 bg-white", readOnly && "bg-gray-50")}
                  />

                  <SelectorFecha
                    value={toDateSafe(e.fecha) ?? undefined}
                    readOnly={readOnly}
                    placeholder="Fecha"
                    className="bg-white"
                    onChange={(d) => actualizarEtiqueta(idx, { fecha: d ?? null })}
                  />

                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => quitarEtiqueta(idx)}
                      className="hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
              {!readOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={agregarEtiqueta}
                  className="gap-2 border-brand-secondary/30"
                >
                  <Plus className="h-4 w-4" />
                  Agregar etiqueta
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                La fecha más próxima define la “próxima acción” del caso en el reporte global.
              </p>
            </div>
          </section>
        )}

        {/* ============ Documentos ============ */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-brand-primary" />
              <Typography variant="h3" className="!text-brand-secondary font-semibold">
                Documentos del caso
              </Typography>
            </div>
            {puedeSubirDocumentos && (
              <label className="inline-flex">
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    subirDocumento(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white cursor-pointer hover:opacity-90",
                    subiendoDoc && "opacity-60 pointer-events-none"
                  )}
                >
                  <Upload className="h-4 w-4" />
                  {subiendoDoc ? "Subiendo..." : "Subir documento"}
                </span>
              </label>
            )}
          </div>

          <div className="p-4 md:p-5">
            {(caso.documentos ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay documentos cargados.
              </p>
            ) : (
              <div className="space-y-2">
                {(caso.documentos ?? []).map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-brand-secondary/15 bg-brand-primary/[0.02]"
                  >
                    <button
                      onClick={() => openStorageFile(d.url || d.path)}
                      className="flex items-center gap-2 text-left min-w-0"
                    >
                      <FileText className="h-4 w-4 text-brand-primary shrink-0" />
                      <span className="text-sm text-brand-primary underline truncate">
                        {d.nombre}
                      </span>
                    </button>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {d.subidoPorRol === "cliente" ? "Aportado por el cliente" : "Gestión Global"}
                        {" · "}
                        {fmtFecha(d.subidoEn)}
                      </span>
                      {puedeSubirDocumentos && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => borrarDocumento(d.id, d.nombre)}
                          className="hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ============ Seguimiento ============ */}
        <section className="rounded-2xl border border-green-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-green-50 p-4 md:p-5 border-b border-green-100 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-green-700" />
            <Typography variant="h3" className="!text-green-800 font-semibold">
              Avance del caso
            </Typography>
          </div>

          {puedeEditarSeguimiento && (
            <div className="p-4 md:p-5 border-b border-brand-secondary/10 grid gap-3 md:grid-cols-[150px_200px_minmax(0,1fr)]">
              <div className="space-y-2">
                <Label className="text-brand-secondary font-medium">Fecha</Label>
                <SelectorFecha
                  value={segFecha}
                  onChange={(d) => d && setSegFecha(d)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-brand-secondary font-medium">Tipo</Label>
                <Select
                  value={segTipo}
                  onValueChange={(v) => setSegTipo(v as TipoSeguimientoCode)}
                >
                  <SelectTrigger className="border-brand-secondary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_SEGUIMIENTO.map((t) => (
                      <SelectItem key={t.code} value={t.code}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-brand-secondary font-medium">Descripción del avance</Label>
                <Textarea
                  value={segDescripcion}
                  onChange={(e) => setSegDescripcion(e.target.value)}
                  rows={3}
                  placeholder="Qué se hizo o qué ocurrió en el proceso. El cliente recibirá esta información."
                  className="border-brand-secondary/30"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    onChange={(e) => setSegArchivo(e.target.files?.[0])}
                    className="text-sm"
                  />
                  <Button
                    onClick={registrarSeguimiento}
                    disabled={segSaving}
                    variant="brand"
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {segSaving ? "Registrando..." : "Registrar avance"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 md:p-5">
            {seguimientos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay avances registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[720px]">
                  <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                    <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                      <TableHead className="w-[120px] text-brand-secondary font-semibold">Fecha</TableHead>
                      <TableHead className="w-[150px] text-brand-secondary font-semibold">Tipo</TableHead>
                      <TableHead className="text-brand-secondary font-semibold">Descripción</TableHead>
                      <TableHead className="w-[130px] text-brand-secondary font-semibold">Adjunto</TableHead>
                      {puedeEditarSeguimiento && (
                        <TableHead className="w-[80px] text-center text-brand-secondary font-semibold">
                          Acciones
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seguimientos.map((s, index) => (
                      <TableRow
                        key={s.id}
                        className={cn(
                          "border-brand-secondary/5",
                          index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]"
                        )}
                      >
                        <TableCell className="text-gray-700">{fmtFecha(s.fecha)}</TableCell>
                        <TableCell className="text-gray-700">
                          {s.tipoSeguimiento ? codeToLabel[s.tipoSeguimiento] ?? s.tipoSeguimiento : "—"}
                        </TableCell>
                        <TableCell className="text-gray-800 whitespace-pre-wrap">
                          {s.descripcion}
                        </TableCell>
                        <TableCell>
                          {s.archivoUrl || s.archivoPath ? (
                            <button
                              onClick={() => openStorageFile(s.archivoUrl || s.archivoPath!)}
                              className="text-sm text-brand-primary underline inline-flex items-center gap-1"
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                              Ver
                            </button>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        {puedeEditarSeguimiento && (
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => borrarSeguimiento(s.id!)}
                              className="hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </section>

        {/* ============ Observaciones ============ */}
        <section className="rounded-2xl border border-amber-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-amber-50 p-4 md:p-5 border-b border-amber-100 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-amber-600" />
            <Typography variant="h3" className="!text-amber-700 font-semibold">
              Observaciones
            </Typography>
          </div>

          <div className="p-4 md:p-5 space-y-4">
            {observaciones.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay observaciones todavía.
              </p>
            ) : (
              <div className="space-y-3">
                {observaciones.map((o) => (
                  <div
                    key={o.id}
                    className={cn(
                      "rounded-lg border p-3",
                      o.autorRol === "cliente"
                        ? "border-amber-200 bg-amber-50/40"
                        : "border-brand-secondary/15 bg-brand-primary/[0.03]"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-semibold text-brand-secondary">
                        {o.autorNombre}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {o.autorRol === "cliente" ? "Cliente" : "Gestión Global"}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {toDateSafe(o.fecha) ? fmtLargo.format(toDateSafe(o.fecha)!) : ""}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{o.texto}</p>
                    {(o.archivoUrl || o.archivoPath) && (
                      <button
                        onClick={() => openStorageFile(o.archivoUrl || o.archivoPath!)}
                        className="mt-2 text-sm text-brand-primary underline inline-flex items-center gap-1"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {o.archivoNombre || "Ver adjunto"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {puedeComentar && (
              <div className="space-y-2 pt-2 border-t border-brand-secondary/10">
                <Textarea
                  value={obsTexto}
                  onChange={(e) => setObsTexto(e.target.value)}
                  rows={3}
                  placeholder="Escribe una observación..."
                  className="border-brand-secondary/30"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    onChange={(e) => setObsArchivo(e.target.files?.[0])}
                    className="text-sm"
                  />
                  <Button
                    onClick={enviarObservacion}
                    disabled={obsSaving || !obsTexto.trim()}
                    variant="brand"
                    className="gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {obsSaving ? "Enviando..." : "Enviar"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Selector de fecha con calendario, mismo patrón que las pantallas de demandas. */
function SelectorFecha({
  value,
  onChange,
  readOnly,
  placeholder = "Seleccionar fecha",
  className,
}: {
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
}) {
  if (readOnly) {
    return (
      <Input
        value={value ? fmt.format(value) : ""}
        readOnly
        className={cn("bg-gray-50 border-brand-secondary/30", className)}
      />
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal border-brand-secondary/30",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? fmt.format(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          defaultMonth={value}
          onSelect={onChange}
          initialFocus
          captionLayout="dropdown"
          fromYear={new Date().getFullYear() - 10}
          toYear={new Date().getFullYear() + 2}
        />
      </PopoverContent>
    </Popover>
  );
}

function Campo({
  label,
  value,
  readOnly,
  onChange,
}: {
  label: string;
  value: string;
  readOnly: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-brand-secondary font-medium">{label}</Label>
      <Input
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className={cn("border-brand-secondary/30", readOnly && "bg-gray-50")}
      />
    </div>
  );
}
