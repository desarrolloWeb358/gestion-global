// src/modules/deudores/pages/DemandaInfoPage.tsx
import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { 
  Gavel, 
  Save, 
  FileText, 
  MessageSquare, 
  Calendar as CalendarIcon,
  Building2,
  MapPin,
  Hash,
  Users
} from "lucide-react";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { db } from "@/firebase";

import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

import { Deudor } from "../models/deudores.model";

import {
  PERMS,
  sanitizeRoles,
  type Rol,
  type Perm,
} from "@/shared/constants/acl";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { Typography } from "@/shared/design-system/components/Typography";
import { BackButton } from "@/shared/design-system/components/BackButton";

import { toast } from "sonner";

/** Helpers de fecha */
function toDateInputValue(anyDate: any): string {
  try {
    if (!anyDate) return "";
    if (typeof anyDate?.toDate === "function") {
      return anyDate.toDate().toISOString().slice(0, 10);
    }
    if (typeof anyDate?.seconds === "number") {
      return new Date(anyDate.seconds * 1000).toISOString().slice(0, 10);
    }
    if (anyDate instanceof Date) {
      return anyDate.toISOString().slice(0, 10);
    }
    const d = new Date(anyDate);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function parseLocalYmd(ymd: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return undefined;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatEs(dateInput: string) {
  if (!dateInput) return "—";
  const d = parseLocalYmd(dateInput) ?? new Date(dateInput);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function DemandaInfoPage() {
  const { clienteId, deudorId } = useParams();
  const navigate = useNavigate();

  // ACL
  const acl = useAcl() as {
    usuario: { roles?: Rol[] } | null;
    roles: Rol[];
    perms: Set<Perm>;
    can: (req: Perm | Perm[]) => boolean;
    loading: boolean;
  };
  const user = acl.usuario ? { roles: acl.usuario.roles } : undefined;
  const can = (p: Perm) => acl.can(p);
  const roles = sanitizeRoles(user?.roles ?? []);
  const aclLoading = acl.loading;
  const puedeEditar = can(PERMS.Deudores_Edit);
  const isCliente = roles.includes("cliente");

  const roDatosPrincipales = !puedeEditar;
  const roObsInternas = !puedeEditar;
  const roObsConjunto = !puedeEditar;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [deudor, setDeudor] = React.useState<Deudor | null>(null);

  const [form, setForm] = React.useState({
    demandados: "",
    juzgado: "",
    numeroRadicado: "",
    localidad: "",
    observacionesDemanda: "",
    observacionesDemandaCliente: "",
    fechaUltimaRevision: "",
  });

  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        if (!clienteId || !deudorId) throw new Error("Faltan parámetros");
        const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error("El deudor no existe");

        const data = { id: deudorId, ...(snap.data() as Deudor) };
        setDeudor(data as Deudor);

        setForm({
          demandados: (data as any).demandados ?? "",
          juzgado: (data as any).juzgado ?? (data as any).juzgadoId ?? "",
          numeroRadicado:
            (data as any).numeroRadicado ?? (data as any).numeroProceso ?? "",
          localidad: (data as any).localidad ?? "",
          observacionesDemanda: (data as any).observacionesDemanda ?? "",
          observacionesDemandaCliente:
            (data as any).observacionesDemandaCliente ?? "",
          fechaUltimaRevision: toDateInputValue((data as any).fechaUltimaRevision),
        });
      } catch (e: any) {
        setError(e.message ?? "Error cargando la demanda");
      } finally {
        setLoading(false);
      }
    })();
  }, [clienteId, deudorId]);

  const onChange =
    (key: keyof typeof form) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((s) => ({ ...s, [key]: e.target.value }));

  const onChangeDate = (key: keyof typeof form) => (date?: Date) => {
    const val = date ? date.toISOString().slice(0, 10) : "";
    setForm((s) => ({ ...s, [key]: val }));
  };

  const handleGuardar = async () => {
    if (!puedeEditar || !clienteId || !deudorId) return;
    try {
      setSaving(true);
      const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);

      const payload: Partial<Deudor> = {
        demandados: form.demandados || "",
        juzgado: form.juzgado || "",
        numeroRadicado: form.numeroRadicado || "",
        localidad: form.localidad || "",
        observacionesDemanda: form.observacionesDemanda || "",
        observacionesDemandaCliente: form.observacionesDemandaCliente || "",
      };

      const prevObsCliente = (deudor as any)?.observacionesDemandaCliente ?? "";
      if ((form.observacionesDemandaCliente || "") !== (prevObsCliente || "")) {
        (payload as any).observacionesDemandaClienteFecha = serverTimestamp();
      }

      if (form.fechaUltimaRevision) {
        payload.fechaUltimaRevision = new Date(form.fechaUltimaRevision);
      } else {
        payload.fechaUltimaRevision = null as any;
      }

      await updateDoc(ref, payload as any);
      setDeudor((prev) => (prev ? ({ ...prev, ...payload } as Deudor) : prev));
      toast.success("✓ Información guardada correctamente");
    } catch (e: any) {
      toast.error("⚠️ No se pudo guardar la información");
      setError(e.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (aclLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-4" />
          <Typography variant="body" className="text-muted">
            Cargando información de la demanda...
          </Typography>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <div className="p-3 rounded-full bg-red-100 inline-block mb-4">
              <Gavel className="h-8 w-8 text-red-600" />
            </div>
            <Typography variant="h2" className="text-red-600 mb-2">
              Error al cargar
            </Typography>
            <Typography variant="body" className="text-muted mb-4">
              {error}
            </Typography>
            <Button 
              variant="outline" 
              onClick={() => navigate(`/clientes/${clienteId}/deudores/${deudorId}`)}
            >
              Volver
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      {/* Overlay de guardado */}
      {saving && (
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="rounded-xl bg-white shadow-lg px-6 py-5 flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
            <Typography variant="body" className="font-medium">
              Guardando cambios...
            </Typography>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        
        {/* HEADER */}
        <header className="space-y-4">
          <div className="flex items-center gap-2">
            <BackButton 
              variant="ghost" 
              size="sm"
              className="text-brand-secondary hover:text-brand-primary hover:bg-brand-primary/5 transition-all"
            />
            <div className="text-sm text-muted-foreground font-secondary flex items-center gap-2">
              <span className="text-muted">Deudor</span>
              <span className="text-muted">/</span>
              <span className="text-brand-primary font-medium">Información de Demanda</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-primary/10">
                <Gavel className="h-6 w-6 text-brand-primary" />
              </div>
              <div>
                <Typography variant="h2" className="!text-brand-primary font-bold">
                  Información de la Demanda
                </Typography>
                <Typography variant="small" className="text-muted mt-0.5">
                  Gestión de datos legales y observaciones
                </Typography>
              </div>
            </div>

            {puedeEditar && (
              <Button
                onClick={handleGuardar}
                disabled={saving}
                variant="brand"
                className="gap-2 shadow-md hover:shadow-lg transition-all"
              >
                <Save className="h-4 w-4" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            )}
          </div>
        </header>

        {/* DATOS PRINCIPALES */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-brand-primary" />
              <Typography variant="h3" className="!text-brand-secondary font-semibold">
                Datos principales
              </Typography>
            </div>
          </div>
          <div className="p-4 md:p-5">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Demandados */}
              <Field
                label="Demandados"
                icon={Users}
                value={form.demandados}
                readOnly={roDatosPrincipales}
                onChange={onChange("demandados")}
                placeholder="Nombre de los demandados"
              />

              {/* Juzgado */}
              <Field
                label="Juzgado"
                icon={Building2}
                value={form.juzgado}
                readOnly={roDatosPrincipales}
                onChange={onChange("juzgado")}
                placeholder="Juzgado asignado"
              />

              {/* Número de radicado */}
              <Field
                label="Número de radicado"
                icon={Hash}
                value={form.numeroRadicado}
                readOnly={roDatosPrincipales}
                onChange={onChange("numeroRadicado")}
                placeholder="Ej: 2024-00123"
              />

              {/* Localidad */}
              <Field
                label="Localidad"
                icon={MapPin}
                value={form.localidad}
                readOnly={roDatosPrincipales}
                onChange={onChange("localidad")}
                placeholder="Ciudad o localidad"
              />

              {/* Fecha última revisión */}
              <DateField
                label="Fecha última revisión"
                value={form.fechaUltimaRevision}
                readOnly={roDatosPrincipales}
                onChangeDate={onChangeDate("fechaUltimaRevision")}
              />
            </div>
          </div>
        </section>

        {/* OBSERVACIONES INTERNAS (Solo para no-clientes) */}
        {!isCliente && (
          <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-orange-50 to-orange-100/50 p-4 md:p-5 border-b border-orange-200/50">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-600" />
                <Typography variant="h3" className="!text-orange-900 font-semibold">
                  Observaciones internas
                </Typography>
              </div>
              <Typography variant="small" className="text-orange-700/70 mt-1">
                Solo visible para el equipo interno
              </Typography>
            </div>
            <div className="p-4 md:p-5">
              <Textarea
                value={form.observacionesDemanda}
                onChange={onChange("observacionesDemanda")}
                readOnly={roObsInternas}
                className="min-h-36 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                placeholder="Notas internas sobre la demanda..."
              />
            </div>
          </section>
        )}

        {/* OBSERVACIONES DEL CONJUNTO */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-green-50 to-green-100/50 p-4 md:p-5 border-b border-green-200/50">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-600" />
              <Typography variant="h3" className="!text-green-900 font-semibold">
                Observaciones del conjunto
              </Typography>
            </div>
            <Typography variant="small" className="text-green-700/70 mt-1">
              Visible para clientes y ejecutivos
            </Typography>
          </div>
          <div className="p-4 md:p-5 space-y-3">
            <Textarea
              value={form.observacionesDemandaCliente}
              onChange={onChange("observacionesDemandaCliente")}
              readOnly={roObsConjunto}
              className="min-h-36 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
              placeholder={isCliente ? "Escribe tu observación para el ejecutivo..." : "Observaciones compartidas con el cliente..."}
            />
            {!isCliente && (
              <div className="text-right">
                <span className="text-xs text-muted-foreground">
                  {(() => {
                    const ts = (deudor as any)?.observacionesDemandaClienteFecha;
                    const d = ts && typeof ts.toDate === "function" ? ts.toDate() : null;
                    return d ? `Última actualización: ${d.toLocaleString("es-CO", { hour12: false })}` : "";
                  })()}
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// Componente Field mejorado
function Field({
  label,
  icon: Icon,
  value,
  readOnly,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  icon?: React.ElementType;
  value: string | number | null | undefined;
  readOnly?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
}) {
  const display = value === null || value === undefined ? "" : String(value);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-brand-secondary flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4" />}
        {label}
      </Label>
      {readOnly ? (
        <div className="rounded-lg border border-brand-secondary/20 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
          {display.trim() ? display : "—"}
        </div>
      ) : (
        <Input 
          value={display} 
          onChange={onChange} 
          type={type}
          placeholder={placeholder}
          className="border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
        />
      )}
    </div>
  );
}

// DateField mejorado
function DateField({ 
  label, 
  value, 
  readOnly, 
  onChangeDate 
}: {
  label: string;
  value: string | null | undefined;
  readOnly?: boolean;
  onChangeDate?: (d?: Date) => void;
}) {
  const dateObj = React.useMemo(() => {
    if (!value) return undefined;
    return parseLocalYmd(value) ?? new Date(value);
  }, [value]);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-brand-secondary flex items-center gap-2">
        <CalendarIcon className="h-4 w-4" />
        {label}
      </Label>
      {readOnly ? (
        <div className="rounded-lg border border-brand-secondary/20 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
          {value ? formatEs(value) : "—"}
        </div>
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full justify-start text-left font-normal border-brand-secondary/30 hover:bg-brand-primary/5"
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-brand-primary" />
              {dateObj ? formatEs(value!) : "Selecciona una fecha"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateObj}
              onSelect={onChangeDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export default DemandaInfoPage;