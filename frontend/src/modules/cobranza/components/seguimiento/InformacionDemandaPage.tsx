// modules/cobranza/components/seguimiento/InformacionDemandaPage.tsx
import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
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
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/ui/popover";
import { db } from "@/firebase";
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import { PERMS, type Rol, type Perm } from "@/shared/constants/acl";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { normalizeDemandados, type DemandadoItem } from "../../models/deudores.model";
import AppBreadcrumb from "@/shared/components/app-breadcrumb";
import { getClienteById } from "@/modules/clientes/services/clienteService";
import { getDeudorById } from "../../services/deudorService";

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

export default function InformacionDemandaPage() {
  const { clienteId, deudorId } = useParams();
  const navigate = useNavigate();

  const acl = useAcl() as {
    roles: Rol[];
    can: (req: Perm | Perm[]) => boolean;
    loading: boolean;
  };
  const puedeEditar = acl.can(PERMS.Seguimientos_Dependientes_Edit);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [nombreCliente, setNombreCliente] = React.useState("Cliente");
  const [deudorNombre, setDeudorNombre] = React.useState("");

  const [demandados, setDemandados] = React.useState<DemandadoItem[]>([]);
  const [form, setForm] = React.useState({
    juzgado: "",
    numeroRadicado: "",
    localidad: "",
    fechaUltimaRevision: "",
  });

  React.useEffect(() => {
    if (!clienteId || !deudorId) return;
    const load = async () => {
      try {
        setLoading(true);
        const [deudorData, clienteData] = await Promise.all([
          getDeudorById(clienteId, deudorId),
          getClienteById(clienteId),
        ]);

        if (clienteData?.nombre) setNombreCliente(clienteData.nombre);
        if (deudorData?.nombre) setDeudorNombre(deudorData.nombre);

        // Normaliza: si demandados es string legacy, lo convierte a array
        setDemandados(normalizeDemandados((deudorData as any)?.demandados));

        setForm({
          juzgado: (deudorData as any)?.juzgado ?? "",
          numeroRadicado: (deudorData as any)?.numeroRadicado ?? "",
          localidad: (deudorData as any)?.localidad ?? "",
          fechaUltimaRevision: toDateInputValue((deudorData as any)?.fechaUltimaRevision),
        });
      } catch {
        toast.error("Error cargando información de la demanda");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [clienteId, deudorId]);

  // Acciones sobre la lista de demandados
  const addDemandado = () =>
    setDemandados((prev) => [...prev, { nombre: "", numeroDocumento: "" }]);

  const removeDemandado = (idx: number) =>
    setDemandados((prev) => prev.filter((_, i) => i !== idx));

  const updateDemandado = (idx: number, field: keyof DemandadoItem, value: string) =>
    setDemandados((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );

  const onChange =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((s) => ({ ...s, [key]: e.target.value }));

  const onChangeDate = (date?: Date) => {
    const val = date ? date.toISOString().slice(0, 10) : "";
    setForm((s) => ({ ...s, fechaUltimaRevision: val }));
  };

  const handleGuardar = async () => {
    if (!clienteId || !deudorId || !puedeEditar) return;
    try {
      setSaving(true);
      const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);

      // Guarda el array limpio (sin entradas vacías)
      const demandadosLimpios = demandados.filter((d) => d.nombre.trim());

      const payload: Record<string, any> = {
        demandados: demandadosLimpios,
        juzgado: form.juzgado || "",
        numeroRadicado: form.numeroRadicado || "",
        localidad: form.localidad || "",
        fechaActualizacion: serverTimestamp(),
      };
      if (form.fechaUltimaRevision) {
        payload.fechaUltimaRevision =
          parseLocalYmd(form.fechaUltimaRevision) ?? new Date(form.fechaUltimaRevision);
      } else {
        payload.fechaUltimaRevision = null;
      }
      await updateDoc(ref, payload);
      toast.success("✓ Información de la demanda guardada");
    } catch {
      toast.error("⚠️ No se pudo guardar la información");
    } finally {
      setSaving(false);
    }
  };

  const readOnly = !puedeEditar;
  const selectedDate = form.fechaUltimaRevision ? parseLocalYmd(form.fechaUltimaRevision) : undefined;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <header className="space-y-4">
          <AppBreadcrumb
            items={[
              { label: "Clientes", href: "/clientes-tables" },
              { label: nombreCliente, href: `/deudores/${clienteId}` },
              { label: deudorNombre, href: `/clientes/${clienteId}/deudores/${deudorId}` },
              { label: "Información de la demanda" },
            ]}
          />

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <Gavel className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <Typography variant="h1" className="!text-brand-primary font-bold">
                  Información de la demanda
                </Typography>
                <Typography variant="small">{deudorNombre}</Typography>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="gap-2 border-brand-secondary/30"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Button>
          </div>
        </header>

        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-red-50 to-orange-50 p-4 md:p-5 border-b border-red-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-red-600" />
              <Typography variant="h3" className="!text-red-700 font-semibold">
                Datos principales
              </Typography>
            </div>

            {puedeEditar && (
              <Button
                onClick={handleGuardar}
                disabled={saving}
                variant="brand"
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            )}
          </div>

          <div className="p-4 md:p-5 space-y-6">
            {/* Lista dinámica de demandados */}
            <div className="space-y-3">
              <Label className="text-brand-secondary font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Demandados
              </Label>

              {demandados.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  {readOnly ? "Sin demandados registrados." : "Agrega al menos un demandado."}
                </p>
              )}

              <div className="space-y-2">
                {demandados.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-3 rounded-lg border border-brand-secondary/15 bg-brand-primary/[0.02]"
                  >
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Nombre completo</p>
                        <Input
                          placeholder="Ej: Juan Pérez Gómez"
                          value={item.nombre}
                          readOnly={readOnly}
                          onChange={(e) => updateDemandado(idx, "nombre", e.target.value)}
                          className={cn(
                            "border-brand-secondary/30",
                            readOnly && "bg-gray-50 cursor-not-allowed"
                          )}
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium">Número de documento</p>
                        <Input
                          placeholder="Ej: 12345678"
                          value={item.numeroDocumento}
                          readOnly={readOnly}
                          onChange={(e) => updateDemandado(idx, "numeroDocumento", e.target.value)}
                          className={cn(
                            "border-brand-secondary/30",
                            readOnly && "bg-gray-50 cursor-not-allowed"
                          )}
                        />
                      </div>
                    </div>

                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDemandado(idx)}
                        className="hover:bg-red-50 mt-5 shrink-0"
                        title="Eliminar demandado"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {!readOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addDemandado}
                  className="gap-2 border-brand-secondary/30 mt-1"
                >
                  <Plus className="h-4 w-4" />
                  Agregar demandado
                </Button>
              )}
            </div>

            {/* Resto de campos en grid */}
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Juzgado"
                icon={Building2}
                value={form.juzgado}
                readOnly={readOnly}
                onChange={onChange("juzgado")}
              />
              <Field
                label="Número de radicado"
                icon={Hash}
                value={form.numeroRadicado}
                readOnly={readOnly}
                onChange={onChange("numeroRadicado")}
              />
              <Field
                label="Localidad"
                icon={MapPin}
                value={form.localidad}
                readOnly={readOnly}
                onChange={onChange("localidad")}
              />

              {/* Fecha última revisión */}
              <div className="space-y-2">
                <Label className="text-brand-secondary font-medium flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Fecha última revisión
                </Label>
                {readOnly ? (
                  <Input
                    value={form.fechaUltimaRevision ? formatEs(form.fechaUltimaRevision) : ""}
                    readOnly
                    className="bg-gray-50 cursor-not-allowed border-brand-secondary/30"
                  />
                ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal border-brand-secondary/30",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? formatEs(form.fechaUltimaRevision) : "Seleccionar fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={onChangeDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>

            {puedeEditar && (
              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleGuardar}
                  disabled={saving}
                  variant="brand"
                  className="gap-2 shadow-md hover:shadow-lg transition-all"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
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
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-brand-secondary font-medium flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </Label>
      <Input
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        className={cn(
          "border-brand-secondary/30",
          readOnly && "bg-gray-50 cursor-not-allowed"
        )}
      />
    </div>
  );
}
